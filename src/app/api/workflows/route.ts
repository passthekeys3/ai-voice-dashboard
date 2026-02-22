import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { ALLOWED_ACTION_TYPES, ALLOWED_TRIGGERS, ALLOWED_ACTION_TYPES_LIST, ALLOWED_TRIGGERS_LIST } from '@/lib/workflows/constants';

// GET /api/workflows - List all workflows
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agent_id');

        let query = supabase
            .from('workflows')
            .select('*, agent:agents(name)')
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false });

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        const { data: workflows, error } = await query;

        if (error) {
            console.error('Error fetching workflows:', error.code);
            return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
        }

        return NextResponse.json({ data: workflows });
    } catch (error) {
        console.error('Error fetching workflows:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, trigger, agent_id, conditions, actions, is_active } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (name.length > 255) {
            return NextResponse.json({ error: 'Name must be 255 characters or less' }, { status: 400 });
        }

        if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return NextResponse.json({ error: 'At least one action is required' }, { status: 400 });
        }

        // Validate action types against shared whitelist
        for (const action of actions) {
            if (!action.type || !ALLOWED_ACTION_TYPES.has(action.type)) {
                return NextResponse.json({
                    error: `Invalid action type: ${action.type}. Allowed: ${ALLOWED_ACTION_TYPES_LIST.join(', ')}`
                }, { status: 400 });
            }
            // Validate required fields for each action type
            if (action.type === 'webhook') {
                if (!action.config?.url) {
                    return NextResponse.json({ error: 'Webhook action requires a URL' }, { status: 400 });
                }
                // SSRF protection: Validate webhook URL
                try {
                    const url = new URL(action.config.url);
                    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                        return NextResponse.json({ error: 'Webhook URL must use HTTP or HTTPS protocol' }, { status: 400 });
                    }
                    // Block URLs with credentials
                    if (url.username || url.password) {
                        return NextResponse.json({ error: 'Webhook URL cannot contain credentials' }, { status: 400 });
                    }
                    // Block internal/private addresses
                    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // Strip IPv6 brackets
                    const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'metadata.google.internal'];
                    if (blockedHosts.includes(hostname)) {
                        return NextResponse.json({ error: 'Webhook URL cannot use localhost or loopback addresses' }, { status: 400 });
                    }
                    // Block IPv6 loopback/private (::1, fe80::, fd00::, ::ffff:127.x.x.x)
                    if (hostname.startsWith('::') || hostname.startsWith('fe80') || hostname.startsWith('fd') || hostname.startsWith('fc')) {
                        return NextResponse.json({ error: 'Webhook URL cannot use private addresses' }, { status: 400 });
                    }
                    // Block private IP ranges (IPv4)
                    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
                    if (ipv4Match) {
                        const [, a, b] = ipv4Match.map(Number);
                        if (a === 10 || a === 0 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
                            return NextResponse.json({ error: 'Webhook URL cannot use private IP addresses' }, { status: 400 });
                        }
                    }
                } catch {
                    return NextResponse.json({ error: 'Invalid webhook URL format' }, { status: 400 });
                }
            }
            if (action.type === 'send_email' && (!action.config?.to || !action.config?.subject)) {
                return NextResponse.json({ error: 'Email action requires a recipient and subject' }, { status: 400 });
            }
            if (action.type === 'send_sms' && !action.config?.message) {
                return NextResponse.json({ error: 'SMS action requires a message' }, { status: 400 });
            }
        }

        // Validate trigger
        if (trigger && !ALLOWED_TRIGGERS.has(trigger)) {
            return NextResponse.json({
                error: `Invalid trigger: ${trigger}. Allowed: ${ALLOWED_TRIGGERS_LIST.join(', ')}`
            }, { status: 400 });
        }

        // Validate conditions if provided
        if (conditions && !Array.isArray(conditions)) {
            return NextResponse.json({ error: 'Conditions must be an array' }, { status: 400 });
        }

        const supabase = await createClient();

        // Validate agent_id belongs to this agency (prevent cross-tenant assignment)
        if (agent_id) {
            const { data: agentCheck } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agent_id)
                .eq('agency_id', user.agency.id)
                .single();
            if (!agentCheck) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
        }

        const { data: workflow, error } = await supabase
            .from('workflows')
            .insert({
                agency_id: user.agency.id,
                agent_id: agent_id || null,
                name,
                description,
                trigger: trigger || 'call_ended',
                conditions: conditions || [],
                actions,
                is_active: is_active !== false,
            })
            .select('*, agent:agents(name)')
            .single();

        if (error) {
            console.error('Error creating workflow:', error.code);
            return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
        }

        return NextResponse.json({ data: workflow }, { status: 201 });
    } catch (error) {
        console.error('Error creating workflow:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
