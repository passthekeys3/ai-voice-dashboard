import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/workflows/[id] - Get a single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const { data: workflow, error } = await supabase
            .from('workflows')
            .select('*, agent:agents(name)')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (error) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        return NextResponse.json({ data: workflow });
    } catch (error) {
        console.error('Error fetching workflow:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/workflows/[id] - Update a workflow
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
        const supabase = await createClient();

        // Validate action types against whitelist if actions are being updated
        if (body.actions !== undefined) {
            if (!Array.isArray(body.actions) || body.actions.length === 0) {
                return NextResponse.json({ error: 'At least one action is required' }, { status: 400 });
            }

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

            for (const action of body.actions) {
                if (!action.type || !ALLOWED_ACTION_TYPES.includes(action.type)) {
                    return NextResponse.json({
                        error: `Invalid action type: ${action.type}. Allowed: ${ALLOWED_ACTION_TYPES.join(', ')}`
                    }, { status: 400 });
                }
                // Validate webhook URLs for SSRF protection
                if (action.type === 'webhook' && action.config?.url) {
                    try {
                        const url = new URL(action.config.url);
                        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                            return NextResponse.json({ error: 'Webhook URL must use HTTP or HTTPS protocol' }, { status: 400 });
                        }
                        // Block URLs with credentials
                        if (url.username || url.password) {
                            return NextResponse.json({ error: 'Webhook URL cannot contain credentials' }, { status: 400 });
                        }
                        const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
                        const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'metadata.google.internal'];
                        if (blockedHosts.includes(hostname)) {
                            return NextResponse.json({ error: 'Webhook URL cannot use localhost or loopback addresses' }, { status: 400 });
                        }
                        // Block IPv6 loopback/private
                        if (hostname.startsWith('::') || hostname.startsWith('fe80') || hostname.startsWith('fd') || hostname.startsWith('fc')) {
                            return NextResponse.json({ error: 'Webhook URL cannot use private addresses' }, { status: 400 });
                        }
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
            }
        }

        // Validate trigger if being updated
        if (body.trigger !== undefined) {
            const ALLOWED_TRIGGERS = [
                'call_ended', 'call_started',
                'inbound_call_started', 'inbound_call_ended',
            ];
            if (!ALLOWED_TRIGGERS.includes(body.trigger)) {
                return NextResponse.json({
                    error: `Invalid trigger: ${body.trigger}. Allowed: ${ALLOWED_TRIGGERS.join(', ')}`
                }, { status: 400 });
            }
        }

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.trigger !== undefined) updateData.trigger = body.trigger;
        if (body.agent_id !== undefined) updateData.agent_id = body.agent_id || null;
        if (body.conditions !== undefined) updateData.conditions = body.conditions;
        if (body.actions !== undefined) updateData.actions = body.actions;
        if (body.is_active !== undefined) updateData.is_active = body.is_active;

        const { data: workflow, error } = await supabase
            .from('workflows')
            .update(updateData)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select('*, agent:agents(name)')
            .single();

        if (error) {
            console.error('Error updating workflow:', error);
            return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
        }

        return NextResponse.json({ data: workflow });
    } catch (error) {
        console.error('Error updating workflow:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

        const { error } = await supabase
            .from('workflows')
            .delete()
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Error deleting workflow:', error);
            return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting workflow:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
