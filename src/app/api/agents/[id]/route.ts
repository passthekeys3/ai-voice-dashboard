import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { isValidUuid } from '@/lib/validation';
import { withErrorHandling } from '@/lib/api/response';

export const GET = withErrorHandling(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
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
        console.error('Error fetching agent:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PATCH = withErrorHandling(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
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
                // Block IPv6 addresses (brackets indicate IPv6 literal in URLs)
                // This prevents bypasses via IPv4-mapped IPv6 (::ffff:10.0.0.1),
                // link-local (fe80::), and unique-local (fc00::/fd00::) addresses
                if (hostname.startsWith('[') || hostname.includes(':')) {
                    return NextResponse.json({ error: 'Webhook URL cannot use IPv6 addresses' }, { status: 400 });
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
        if (body.name !== undefined) {
            const trimmedName = typeof body.name === 'string' ? body.name.trim() : '';
            if (!trimmedName) {
                return NextResponse.json({ error: 'Agent name cannot be empty' }, { status: 400 });
            }
            updatePayload.name = trimmedName;
        }
        if (body.client_id !== undefined) updatePayload.client_id = body.client_id;
        if (body.config !== undefined) updatePayload.config = body.config;
        if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
        if (body.webhook_url !== undefined) updatePayload.webhook_url = body.webhook_url;
        if (body.widget_enabled !== undefined) updatePayload.widget_enabled = body.widget_enabled;
        if (body.widget_config !== undefined) {
            const wc = body.widget_config;
            if (typeof wc !== 'object' || wc === null || Array.isArray(wc)) {
                return NextResponse.json({ error: 'Invalid widget config format' }, { status: 400 });
            }
            // Validate avatar_url — block javascript: and data: schemes
            if (wc.avatar_url && typeof wc.avatar_url === 'string' && wc.avatar_url.trim()) {
                try {
                    const parsed = new URL(wc.avatar_url);
                    if (!['http:', 'https:'].includes(parsed.protocol)) {
                        return NextResponse.json({ error: 'Avatar URL must use https' }, { status: 400 });
                    }
                } catch {
                    return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
                }
            }
            // Validate color
            if (wc.color && typeof wc.color === 'string' && !/^#[0-9a-fA-F]{3,8}$/.test(wc.color)) {
                return NextResponse.json({ error: 'Invalid widget color: must be a hex color' }, { status: 400 });
            }
            updatePayload.widget_config = wc;
        }

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
        console.error('Error updating agent:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const DELETE = withErrorHandling(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const supabase = await createClient();

        // Fetch agent so we can clean up on the provider
        const { data: agent } = await supabase
            .from('agents')
            .select('id, external_id, provider, client_id')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Pre-delete safety check: block if agent has active dependencies
        const [{ count: activeWorkflows }, { count: pendingCalls }] = await Promise.all([
            supabase
                .from('workflows')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', id)
                .eq('agency_id', user.agency.id)
                .eq('is_active', true),
            supabase
                .from('scheduled_calls')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', id)
                .eq('agency_id', user.agency.id)
                .eq('status', 'pending'),
        ]);

        if ((activeWorkflows && activeWorkflows > 0) || (pendingCalls && pendingCalls > 0)) {
            const reasons: string[] = [];
            if (activeWorkflows && activeWorkflows > 0) reasons.push(`${activeWorkflows} active workflow(s)`);
            if (pendingCalls && pendingCalls > 0) reasons.push(`${pendingCalls} pending scheduled call(s)`);
            return NextResponse.json(
                { error: `Cannot delete agent with ${reasons.join(' and ')}. Deactivate or cancel them first.` },
                { status: 409 },
            );
        }

        // Delete from voice provider only if explicitly requested
        const deleteFromProvider = request.nextUrl.searchParams.get('deleteFromProvider') === 'true';
        if (deleteFromProvider && agent.external_id) {
            try {
                // Resolve keys (client key → agency key fallback)
                const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
                const apiKey = getProviderKey(resolvedKeys, agent.provider as 'retell' | 'vapi' | 'bland');

                if (apiKey) {
                    if (agent.provider === 'retell') {
                        const { deleteRetellAgent } = await import('@/lib/providers/retell');
                        await deleteRetellAgent(apiKey, agent.external_id);
                    } else if (agent.provider === 'vapi') {
                        const { deleteVapiAssistant } = await import('@/lib/providers/vapi');
                        await deleteVapiAssistant(apiKey, agent.external_id);
                    } else if (agent.provider === 'bland') {
                        const { deleteBlandPathway } = await import('@/lib/providers/bland');
                        await deleteBlandPathway(apiKey, agent.external_id);
                    }
                }
            } catch (providerErr) {
                // Log but don't fail — the DB record should still be removed
                console.error('Provider cleanup failed during agent deletion:', providerErr instanceof Error ? providerErr.message : 'Unknown error');
            }
        }

        // Unassign phone numbers that reference this agent
        await supabase
            .from('phone_numbers')
            .update({
                agent_id: null,
                inbound_agent_id: null,
                outbound_agent_id: null,
                updated_at: new Date().toISOString(),
            })
            .eq('agency_id', user.agency.id)
            .or(`agent_id.eq.${id},inbound_agent_id.eq.${id},outbound_agent_id.eq.${id}`);

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
        console.error('Error deleting agent:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
