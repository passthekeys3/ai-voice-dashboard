import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = await createClient();

        const { data: agent, error } = await supabase
            .from('agents')
            .select('*, clients(name)')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (error || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Client users can only access their own agents
        if (!isAgencyAdmin(user) && agent.client_id !== user.client?.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ data: agent });
    } catch (error) {
        console.error('Error fetching agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        // Validate webhook URL to prevent SSRF attacks
        if (body.webhook_url) {
            try {
                const url = new URL(body.webhook_url);
                // Enforce HTTPS in production, allow HTTP in development
                if (process.env.NODE_ENV === 'production') {
                    if (url.protocol !== 'https:') {
                        return NextResponse.json({ error: 'Webhook URL must use HTTPS in production' }, { status: 400 });
                    }
                } else if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                    return NextResponse.json({ error: 'Webhook URL must use HTTP or HTTPS protocol' }, { status: 400 });
                }
                // Block internal/private IP addresses
                const hostname = url.hostname.toLowerCase();
                const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'];
                if (blockedHosts.includes(hostname)) {
                    return NextResponse.json({ error: 'Webhook URL cannot use localhost or loopback addresses' }, { status: 400 });
                }
                // Block private IP ranges (basic check for IPv4)
                const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
                if (ipv4Match) {
                    const [, a, b] = ipv4Match.map(Number);
                    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
                    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
                        return NextResponse.json({ error: 'Webhook URL cannot use private IP addresses' }, { status: 400 });
                    }
                }
            } catch {
                return NextResponse.json({ error: 'Invalid webhook URL format' }, { status: 400 });
            }
        }

        const supabase = await createClient();

        // Validate client_id belongs to this agency (if being updated)
        if (body.client_id !== undefined && body.client_id !== null) {
            const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('id', body.client_id)
                .eq('agency_id', user.agency.id)
                .single();

            if (!client) {
                return NextResponse.json({ error: 'Client not found' }, { status: 404 });
            }
        }

        // Build update payload — only include fields that are present in the request
        const updatePayload: Record<string, unknown> = {};
        if (body.name !== undefined) updatePayload.name = body.name;
        if (body.client_id !== undefined) updatePayload.client_id = body.client_id;
        if (body.config !== undefined) updatePayload.config = body.config;
        if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
        if (body.webhook_url !== undefined) updatePayload.webhook_url = body.webhook_url;
        if (body.widget_enabled !== undefined) updatePayload.widget_enabled = body.widget_enabled;
        if (body.widget_config !== undefined) updatePayload.widget_config = body.widget_config;

        const { data: agent, error } = await supabase
            .from('agents')
            .update(updatePayload)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
        }

        return NextResponse.json({ data: agent });
    } catch (error) {
        console.error('Error updating agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = await createClient();

        // Fetch agent + agency keys so we can clean up on the provider
        const { data: agent } = await supabase
            .from('agents')
            .select('id, external_id, provider')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Delete from voice provider (best-effort — don't block DB deletion on provider failure)
        if (agent.external_id) {
            try {
                const { data: agency } = await supabase
                    .from('agencies')
                    .select('retell_api_key, vapi_api_key, bland_api_key')
                    .eq('id', user.agency.id)
                    .single();

                if (agent.provider === 'retell' && agency?.retell_api_key) {
                    const { deleteRetellAgent } = await import('@/lib/providers/retell');
                    await deleteRetellAgent(agency.retell_api_key, agent.external_id);
                } else if (agent.provider === 'vapi' && agency?.vapi_api_key) {
                    const { deleteVapiAssistant } = await import('@/lib/providers/vapi');
                    await deleteVapiAssistant(agency.vapi_api_key, agent.external_id);
                } else if (agent.provider === 'bland' && agency?.bland_api_key) {
                    const { deleteBlandPathway } = await import('@/lib/providers/bland');
                    await deleteBlandPathway(agency.bland_api_key, agent.external_id);
                }
            } catch (providerErr) {
                // Log but don't fail — the DB record should still be removed
                console.error('Provider cleanup failed during agent deletion:', providerErr);
            }
        }

        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (error) {
            return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting agent:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
