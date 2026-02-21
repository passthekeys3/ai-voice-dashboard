import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

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
            console.error('Error fetching workflows:', error);
            return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
        }

        return NextResponse.json({ data: workflows });
    } catch (error) {
        console.error('Error fetching workflows:', error);
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

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return NextResponse.json({ error: 'At least one action is required' }, { status: 400 });
        }

        // Validate action types against whitelist
        const ALLOWED_ACTION_TYPES = [
            'webhook',
            // GHL integrations
            'ghl_log_call', 'ghl_create_contact', 'ghl_add_tags', 'ghl_update_pipeline', 'ghl_lead_score',
            'ghl_book_appointment', 'ghl_cancel_appointment',
            'ghl_upsert_contact', 'ghl_add_call_note', 'ghl_trigger_workflow', 'ghl_update_contact_field',
            // HubSpot integrations
            'hubspot_log_call', 'hubspot_create_contact', 'hubspot_update_contact',
            'hubspot_add_tags', 'hubspot_update_pipeline', 'hubspot_lead_score',
            'hubspot_book_appointment', 'hubspot_cancel_appointment',
            'hubspot_upsert_contact', 'hubspot_add_call_note', 'hubspot_trigger_workflow', 'hubspot_update_contact_field',
            // Google Calendar integrations
            'gcal_book_event', 'gcal_cancel_event', 'gcal_check_availability',
            // Calendly integrations
            'calendly_check_availability', 'calendly_create_booking_link', 'calendly_cancel_event',
            // Messaging & notifications
            'send_sms', 'send_email', 'send_slack',
        ];
        const ALLOWED_TRIGGERS = [
            'call_ended', 'call_started',
            'inbound_call_started', 'inbound_call_ended',
        ];

        for (const action of actions) {
            if (!action.type || !ALLOWED_ACTION_TYPES.includes(action.type)) {
                return NextResponse.json({
                    error: `Invalid action type: ${action.type}. Allowed: ${ALLOWED_ACTION_TYPES.join(', ')}`
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
        if (trigger && !ALLOWED_TRIGGERS.includes(trigger)) {
            return NextResponse.json({
                error: `Invalid trigger: ${trigger}. Allowed: ${ALLOWED_TRIGGERS.join(', ')}`
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
            console.error('Error creating workflow:', error);
            return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
        }

        return NextResponse.json({ data: workflow }, { status: 201 });
    } catch (error) {
        console.error('Error creating workflow:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
