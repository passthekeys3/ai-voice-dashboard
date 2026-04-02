import { NextRequest, NextResponse } from 'next/server';
import type { VoiceProvider } from '@/types';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import * as retell from '@/lib/providers/retell';
import * as vapiKb from '@/lib/providers/vapi-kb';
import * as blandKb from '@/lib/providers/bland-kb';
import { isValidUuid } from '@/lib/validation';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ============================================
// SSRF URL VALIDATION (shared across providers)
// ============================================

function validateUrl(url: string): string | null {
    if (!url || typeof url !== 'string' || url.length > 2048) {
        return 'Invalid or overly long URL (max 2048 characters)';
    }
    try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
            return 'URL must use HTTP or HTTPS protocol';
        }
        // Block credentials in URL (user:pass@host)
        if (urlObj.username || urlObj.password) {
            return 'URLs with embedded credentials are not allowed';
        }
        const hostname = urlObj.hostname.toLowerCase();
        const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'];
        if (blockedHosts.includes(hostname)) {
            return 'Cannot add localhost or loopback URLs';
        }
        // Block bare IP addresses entirely — only allow domain names.
        // This prevents IPv4 bypass via octal (0177.0.0.1), decimal (2130706433),
        // IPv4-mapped IPv6 (::ffff:127.0.0.1), and 0.0.0.0/8 range.
        const bareHost = hostname.replace(/^\[|\]$/g, '');
        if (/^[\d.]+$/.test(bareHost) || bareHost.includes(':')) {
            return 'Direct IP addresses are not allowed. Use a domain name instead.';
        }
    } catch {
        return 'Invalid URL format';
    }
    return null; // Valid
}

// ============================================
// FILE SIZE LIMITS PER PROVIDER
// ============================================

const FILE_SIZE_LIMITS: Record<string, number> = {
    retell: 50 * 1024 * 1024,     // 50MB
    vapi: 10 * 1024 * 1024,       // 10MB (conservative; Vapi recommends 300KB but allows more)
    bland: 10 * 1024 * 1024,      // 10MB
};

const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/tab-separated-values',
    'application/json',
    'application/xml',
    'text/xml',
];

// POST /api/agents/[id]/knowledge-base/sources - Add sources to KB
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Verify agent and get config
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, config, agency_id, client_id, provider')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const kbId = agent.config?.knowledge_base_id;
        if (!kbId) {
            return NextResponse.json({ error: 'No knowledge base for this agent. Create one first.' }, { status: 400 });
        }

        // Resolve provider API key
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json({ error: `No ${agent.provider} API key configured` }, { status: 400 });
        }

        // Determine content type — file upload uses FormData, text/url uses JSON
        const contentType = request.headers.get('content-type') || '';
        const isFileUpload = contentType.includes('multipart/form-data');

        if (isFileUpload) {
            return handleFileUpload(request, agent, apiKey, kbId, supabase, agentId);
        } else {
            return handleTextOrUrl(request, agent, apiKey, kbId, supabase, agentId);
        }
    } catch (error) {
        console.error('Error adding KB source:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Failed to add knowledge base source' }, { status: 500 });
    }
}

// ============================================
// FILE UPLOAD HANDLER
// ============================================

async function handleFileUpload(
    request: NextRequest,
    agent: { id: string; name: string; config: Record<string, unknown>; agency_id: string; provider: string },
    apiKey: string,
    kbId: string,
    supabase: ReturnType<typeof createServiceClient>,
    agentId: string,
) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type — require BOTH valid MIME type AND valid extension
    // to prevent extension spoofing (e.g., malicious.exe with spoofed MIME)
    const hasValidMime = ALLOWED_FILE_TYPES.includes(file.type);
    const hasValidExt = /\.(pdf|docx?|txt|csv|md|tsv|json|xml)$/i.test(file.name);
    if (!hasValidMime || !hasValidExt) {
        return NextResponse.json({
            error: 'Unsupported file type. Supported: PDF, DOCX, DOC, TXT, CSV, MD, TSV, JSON, XML'
        }, { status: 400 });
    }
    // Block double extensions that could indicate masquerading (e.g., "report.exe.pdf")
    const nameParts = file.name.split('.');
    if (nameParts.length > 2) {
        const suspiciousExts = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'dll', 'scr', 'com', 'vbs', 'js', 'jar'];
        if (nameParts.slice(1, -1).some(ext => suspiciousExts.includes(ext.toLowerCase()))) {
            return NextResponse.json({ error: 'Suspicious file name detected' }, { status: 400 });
        }
    }

    // Validate file size
    const maxSize = FILE_SIZE_LIMITS[agent.provider] || 10 * 1024 * 1024;
    if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / 1024 / 1024);
        return NextResponse.json({ error: `File too large (max ${maxMB}MB for ${agent.provider})` }, { status: 400 });
    }

    if (agent.provider === 'retell') {
        // Retell: upload file to existing KB via multipart POST
        const fd = new FormData();
        fd.append('knowledge_base_files', file, file.name);

        const response = await fetch(`https://api.retellai.com/add-knowledge-base-sources/${encodeURIComponent(kbId)}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: fd,
            signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error('Retell file upload error:', response.status, errText);
            return NextResponse.json({ error: 'Failed to upload file to Retell' }, { status: 500 });
        }

        const uploadResult = await response.json();
        return NextResponse.json({ data: uploadResult, message: 'File uploaded successfully' });

    } else if (agent.provider === 'vapi') {
        // Vapi: upload file → add fileId to KB
        const vapiFile = await vapiKb.createVapiFile(apiKey, file, file.name);

        // Update the KB to include this new file
        const kb = await vapiKb.getVapiKnowledgeBase(apiKey, kbId);
        const existingFileIds = kb.fileIds || [];
        await vapiKb.updateVapiKnowledgeBase(apiKey, kbId, {
            fileIds: [...existingFileIds, vapiFile.id],
        });

        return NextResponse.json({
            data: { source_id: vapiFile.id, source_type: 'file', source_name: vapiFile.name },
            message: 'File uploaded successfully'
        });

    } else if (agent.provider === 'bland') {
        // Bland: create a new KB from the file
        const blandResult = await blandKb.createBlandFileKB(apiKey, {
            name: file.name,
            description: `File: ${file.name}`,
            file,
            filename: file.name,
        });

        // Store the new KB ID in the agent's bland_kb_ids array
        await appendBlandKbId(supabase, agentId, agent.agency_id, blandResult.id);

        return NextResponse.json({
            data: { source_id: blandResult.id, source_type: 'file', source_name: file.name },
            message: 'File uploaded successfully'
        });
    }

    return NextResponse.json({ error: `File upload not supported for ${agent.provider}` }, { status: 400 });
}

// ============================================
// BLAND KB ID PERSISTENCE HELPER
// ============================================

/**
 * Re-reads the agent's latest config before appending a new Bland KB ID.
 * This narrows the race window vs. using the stale `agent.config` from
 * the initial query (which may be seconds old after a provider API call).
 */
async function appendBlandKbId(
    supabase: ReturnType<typeof createServiceClient>,
    agentId: string,
    agencyId: string,
    newKbId: string,
): Promise<void> {
    // Re-read latest config to minimize race window
    const { data: freshAgent } = await supabase
        .from('agents')
        .select('config')
        .eq('id', agentId)
        .eq('agency_id', agencyId)
        .single();

    const freshConfig = (freshAgent?.config as Record<string, unknown>) || {};
    const existingIds: string[] = (freshConfig.bland_kb_ids as string[]) || [];

    // Deduplicate in case of concurrent writes
    if (existingIds.includes(newKbId)) return;

    await supabase
        .from('agents')
        .update({ config: { ...freshConfig, bland_kb_ids: [...existingIds, newKbId] } })
        .eq('id', agentId)
        .eq('agency_id', agencyId);
}

// ============================================
// TEXT / URL SOURCE HANDLER
// ============================================

async function handleTextOrUrl(
    request: NextRequest,
    agent: { id: string; name: string; config: Record<string, unknown>; agency_id: string; provider: string },
    apiKey: string,
    kbId: string,
    supabase: ReturnType<typeof createServiceClient>,
    agentId: string,
) {
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { type, title, content, url, enableAutoRefresh } = body as {
        type?: string; title?: string; content?: string; url?: string; enableAutoRefresh?: boolean;
    };

    if (type === 'text') {
        if (!content || typeof content !== 'string') {
            return NextResponse.json({ error: 'Content is required for text sources' }, { status: 400 });
        }
        if (content.length > 100000) {
            return NextResponse.json({ error: 'Content too large (max 100KB)' }, { status: 400 });
        }
        if (title && typeof title === 'string' && title.length > 500) {
            return NextResponse.json({ error: 'Title too long (max 500 characters)' }, { status: 400 });
        }

        if (agent.provider === 'retell') {
            const result = await retell.addRetellKBSources(apiKey, kbId, {
                knowledge_base_texts: [{ title: title || 'Untitled', text: content }],
            });
            return NextResponse.json({ data: result, message: 'Text source added' });

        } else if (agent.provider === 'bland') {
            const blandResult = await blandKb.createBlandTextKB(apiKey, {
                name: title || 'Text Source',
                text: content,
            });
            await appendBlandKbId(supabase, agentId, agent.agency_id, blandResult.id);
            return NextResponse.json({
                data: { source_id: blandResult.id, source_type: 'text', source_name: title || 'Text Source' },
                message: 'Text source added'
            });

        } else if (agent.provider === 'vapi') {
            return NextResponse.json({ error: 'Vapi only supports file uploads for knowledge bases' }, { status: 400 });
        }

    } else if (type === 'url') {
        const urlError = validateUrl(url || '');
        if (urlError) {
            return NextResponse.json({ error: urlError }, { status: 400 });
        }

        if (agent.provider === 'retell') {
            const result = await retell.addRetellKBSources(apiKey, kbId, {
                knowledge_base_urls: [{ url: url!, enable_auto_refresh: enableAutoRefresh }],
            });
            return NextResponse.json({ data: result, message: 'URL source added' });

        } else if (agent.provider === 'bland') {
            const blandResult = await blandKb.createBlandWebKB(apiKey, {
                name: `Web: ${new URL(url!).hostname}`,
                urls: [url!],
            });
            await appendBlandKbId(supabase, agentId, agent.agency_id, blandResult.id);
            return NextResponse.json({
                data: { source_id: blandResult.id, source_type: 'url', source_name: url },
                message: 'URL source added'
            });

        } else if (agent.provider === 'vapi') {
            return NextResponse.json({ error: 'Vapi only supports file uploads for knowledge bases' }, { status: 400 });
        }
    } else {
        return NextResponse.json({ error: 'Invalid source type. Use "text", "url", or upload a file.' }, { status: 400 });
    }

    return NextResponse.json({ error: `Source type not supported for ${agent.provider}` }, { status: 400 });
}
