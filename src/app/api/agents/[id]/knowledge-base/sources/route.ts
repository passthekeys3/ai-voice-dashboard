import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import * as retell from '@/lib/providers/retell';

interface RouteParams {
    params: Promise<{ id: string }>;
}

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
        const body = await request.json();
        const { type, title, content, url, enableAutoRefresh } = body;

        const supabase = createServiceClient();

        // Verify agent and get KB ID
        const { data: agent } = await supabase
            .from('agents')
            .select('id, config, agency_id')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const kbId = agent.config?.knowledge_base_id;
        if (!kbId) {
            return NextResponse.json({ error: 'No knowledge base for this agent' }, { status: 400 });
        }

        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key configured' }, { status: 400 });
        }

        // Add source based on type
        let result;
        if (type === 'text') {
            result = await retell.addRetellKBSources(agency.retell_api_key, kbId, {
                knowledge_base_texts: [{ title, text: content }],
            });
        } else if (type === 'url') {
            // SSRF protection: Validate URL before adding to knowledge base
            try {
                const urlObj = new URL(url);
                if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
                    return NextResponse.json({ error: 'URL must use HTTP or HTTPS protocol' }, { status: 400 });
                }
                // Block internal/private addresses
                const hostname = urlObj.hostname.toLowerCase();
                const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'];
                if (blockedHosts.includes(hostname)) {
                    return NextResponse.json({ error: 'Cannot add localhost or loopback URLs' }, { status: 400 });
                }
                // Block private IP ranges (IPv4)
                const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
                if (ipv4Match) {
                    const [, a, b] = ipv4Match.map(Number);
                    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
                        return NextResponse.json({ error: 'Cannot add private IP addresses' }, { status: 400 });
                    }
                }
            } catch {
                return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
            }
            result = await retell.addRetellKBSources(agency.retell_api_key, kbId, {
                knowledge_base_urls: [{ url, enable_auto_refresh: enableAutoRefresh }],
            });
        } else {
            return NextResponse.json({ error: 'Invalid source type' }, { status: 400 });
        }

        return NextResponse.json({
            data: result,
            message: 'Source added successfully'
        });
    } catch (error) {
        console.error('Error adding KB source:', error);
        const message = error instanceof Error ? error.message : 'Failed to add source';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
