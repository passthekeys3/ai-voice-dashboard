import { NextRequest, NextResponse } from 'next/server';
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
        const hostname = urlObj.hostname.toLowerCase();
        const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'];
        if (blockedHosts.includes(hostname)) {
            return 'Cannot add localhost or loopback URLs';
        }
        // Block private IP ranges (IPv4)
        const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4Match) {
            const [, a, b] = ipv4Match.map(Number);
            if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
                return 'Cannot add private IP addresses';
            }
        }
        // Block IPv6 private/reserved ranges
        const bareHost = hostname.replace(/^\[|\]$/g, '');
        if (bareHost.includes(':')) {
            const lowerIpv6 = bareHost.toLowerCase();
            if (lowerIpv6 === '::1' || lowerIpv6 === '::' ||
                lowerIpv6.startsWith('fe80') || lowerIpv6.startsWith('fc') ||
                lowerIpv6.startsWith('fd') || lowerIpv6.startsWith('::ffff:')) {
                return 'Cannot add private IP addresses';
            }
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
        const apiKey = getProviderKey(resolvedKeys, agent.provider as 'retell' | 'vapi' | 'bland');

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

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx?|txt|csv|md|tsv|json|xml)$/i)) {
        return NextResponse.json({
            error: 'Unsupported file type. Supported: PDF, DOCX, DOC, TXT, CSV, MD, TSV, JSON, XML'
        }, { status: 400 });
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
        const existingIds: string[] = (agent.config?.bland_kb_ids as string[]) || [];
        const updatedConfig = {
            ...agent.config,
            bland_kb_ids: [...existingIds, blandResult.id],
        };

        await supabase
            .from('agents')
            .update({ config: updatedConfig })
            .eq('id', agentId)
            .eq('agency_id', agent.agency_id);

        return NextResponse.json({
            data: { source_id: blandResult.id, source_type: 'file', source_name: file.name },
            message: 'File uploaded successfully'
        });
    }

    return NextResponse.json({ error: `File upload not supported for ${agent.provider}` }, { status: 400 });
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
            // Store KB ID
            const existingIds: string[] = (agent.config?.bland_kb_ids as string[]) || [];
            await supabase
                .from('agents')
                .update({ config: { ...agent.config, bland_kb_ids: [...existingIds, blandResult.id] } })
                .eq('id', agentId)
                .eq('agency_id', agent.agency_id);
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
            const existingIds: string[] = (agent.config?.bland_kb_ids as string[]) || [];
            await supabase
                .from('agents')
                .update({ config: { ...agent.config, bland_kb_ids: [...existingIds, blandResult.id] } })
                .eq('id', agentId)
                .eq('agency_id', agent.agency_id);
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
