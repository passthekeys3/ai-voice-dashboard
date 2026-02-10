/**
 * HubSpot Outbound Trigger Webhook
 *
 * POST /api/hubspot/trigger-call
 *
 * Receives webhook POSTs from HubSpot workflows to initiate
 * outbound AI voice calls. Supports timezone-aware scheduling.
 *
 * Authentication: HubSpot v3 signature verification using
 * HUBSPOT_CLIENT_SECRET or per-agency webhook secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { initiateCall } from '@/lib/calls/initiate';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { verifyHubSpotTriggerSignature, validateHubSpotTriggerPayload } from './validate';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-hubspot-signature-v3');
        const timestamp = request.headers.get('x-hubspot-request-timestamp');

        // Parse payload
        let payload: unknown;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Validate payload schema
        const validation = validateHubSpotTriggerPayload(payload);
        if (!validation.success || !validation.data) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const data = validation.data;
        const supabase = createServiceClient();

        // Look up agency by HubSpot portal_id
        const { data: agencies, error: agencyError } = await supabase
            .from('agencies')
            .select('id, integrations, calling_window, retell_api_key, vapi_api_key')
            .filter('integrations->hubspot->>portal_id', 'eq', data.portal_id);

        if (agencyError || !agencies || agencies.length === 0) {
            return NextResponse.json(
                { error: 'No agency found for this portal_id' },
                { status: 404 },
            );
        }

        const agency = agencies[0];
        const hubspotConfig = agency.integrations?.hubspot;
        const triggerConfig = hubspotConfig?.trigger_config;

        // Verify trigger is enabled
        if (!triggerConfig?.enabled) {
            return NextResponse.json(
                { error: 'HubSpot trigger is not enabled for this agency' },
                { status: 403 },
            );
        }

        // Verify webhook signature using the webhook secret
        const requestUrl = request.url;
        if (!verifyHubSpotTriggerSignature(rawBody, signature, timestamp, triggerConfig.webhook_secret, 'POST', requestUrl)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Resolve which agent to use
        let agentId = data.agent_id;
        let agentRecord: { id: string; external_id: string; provider: string; name: string } | null = null;

        if (agentId) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id, external_id, provider, name')
                .eq('id', agentId)
                .eq('agency_id', agency.id)
                .single();
            agentRecord = agent;
        }

        if (!agentRecord && triggerConfig.default_agent_id) {
            agentId = triggerConfig.default_agent_id;
            const { data: agent } = await supabase
                .from('agents')
                .select('id, external_id, provider, name')
                .eq('id', agentId)
                .eq('agency_id', agency.id)
                .single();
            agentRecord = agent;
        }

        if (!agentRecord && data.from_number) {
            const { data: phoneNumber } = await supabase
                .from('phone_numbers')
                .select('outbound_agent_id')
                .eq('phone_number', data.from_number)
                .eq('agency_id', agency.id)
                .single();

            if (phoneNumber?.outbound_agent_id) {
                const { data: agent } = await supabase
                    .from('agents')
                    .select('id, external_id, provider, name')
                    .eq('id', phoneNumber.outbound_agent_id)
                    .eq('agency_id', agency.id)
                    .single();
                agentRecord = agent;
            }
        }

        if (!agentRecord) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                hubspot_contact_id: data.contact_id,
                contact_name: data.contact_name,
                status: 'failed',
                error_message: 'No agent could be resolved. Configure a default agent in HubSpot trigger settings.',
                request_payload: data as unknown as Record<string, unknown>,
            });
            return NextResponse.json(
                { error: 'No agent configured. Set a default agent in trigger settings.' },
                { status: 400 },
            );
        }

        // Detect lead timezone
        const leadTimezone = detectTimezone(data.phone_number);

        // Check calling window
        const callingWindow = agency.calling_window ?? hubspotConfig?.calling_window;
        let shouldSchedule = false;
        let scheduledAt: Date | null = null;

        if (data.scheduled_at) {
            scheduledAt = new Date(data.scheduled_at);
            shouldSchedule = true;
        } else if (callingWindow?.enabled && leadTimezone) {
            const windowConfig = {
                startHour: callingWindow.start_hour,
                endHour: callingWindow.end_hour,
                daysOfWeek: callingWindow.days_of_week,
            };

            if (!isWithinCallingWindow(leadTimezone, windowConfig)) {
                scheduledAt = getNextValidCallTime(leadTimezone, windowConfig);
                shouldSchedule = true;
            }
        }

        // Get provider API key
        const providerApiKey = agentRecord.provider === 'vapi'
            ? agency.vapi_api_key
            : agency.retell_api_key;

        if (!providerApiKey) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                hubspot_contact_id: data.contact_id,
                contact_name: data.contact_name,
                status: 'failed',
                lead_timezone: leadTimezone ?? undefined,
                error_message: `${agentRecord.provider} API key not configured`,
                request_payload: data as unknown as Record<string, unknown>,
            });
            return NextResponse.json(
                { error: `${agentRecord.provider} API key not configured` },
                { status: 400 },
            );
        }

        if (shouldSchedule && scheduledAt) {
            // Schedule for later
            const { data: scheduledCall, error: schedError } = await supabase
                .from('scheduled_calls')
                .insert({
                    agency_id: agency.id,
                    agent_id: agentRecord.id,
                    to_number: data.phone_number,
                    contact_name: data.contact_name,
                    scheduled_at: scheduledAt.toISOString(),
                    lead_timezone: leadTimezone,
                    original_scheduled_at: data.scheduled_at || new Date().toISOString(),
                    timezone_delayed: !data.scheduled_at,
                    trigger_source: 'hubspot_trigger',
                    hubspot_contact_id: data.contact_id,
                    metadata: data.metadata,
                })
                .select('id')
                .single();

            if (schedError) {
                console.error('HubSpot trigger schedule error:', schedError);
                return NextResponse.json({ error: 'Failed to schedule call' }, { status: 500 });
            }

            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                hubspot_contact_id: data.contact_id,
                contact_name: data.contact_name,
                status: 'scheduled',
                scheduled_call_id: scheduledCall?.id,
                lead_timezone: leadTimezone ?? undefined,
                timezone_delayed: !data.scheduled_at,
                scheduled_at: scheduledAt.toISOString(),
                request_payload: data as unknown as Record<string, unknown>,
            });

            return NextResponse.json({
                status: 'scheduled',
                scheduled_at: scheduledAt.toISOString(),
                lead_timezone: leadTimezone,
                agent: agentRecord.name,
                scheduled_call_id: scheduledCall?.id,
            });
        }

        // Call immediately
        const callResult = await initiateCall({
            provider: agentRecord.provider as 'retell' | 'vapi',
            providerApiKey,
            externalAgentId: agentRecord.external_id,
            toNumber: data.phone_number,
            fromNumber: data.from_number,
            metadata: {
                hubspot_contact_id: data.contact_id,
                hubspot_portal_id: data.portal_id,
                contact_name: data.contact_name,
                lead_timezone: leadTimezone,
                trigger_source: 'hubspot_trigger',
                ...(data.metadata || {}),
            },
        });

        if (!callResult.success) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                hubspot_contact_id: data.contact_id,
                contact_name: data.contact_name,
                status: 'failed',
                lead_timezone: leadTimezone ?? undefined,
                error_message: callResult.error,
                request_payload: data as unknown as Record<string, unknown>,
            });
            return NextResponse.json(
                { error: callResult.error || 'Failed to initiate call' },
                { status: 500 },
            );
        }

        // Insert into scheduled_calls as completed for tracking
        const { data: scheduledCall } = await supabase
            .from('scheduled_calls')
            .insert({
                agency_id: agency.id,
                agent_id: agentRecord.id,
                to_number: data.phone_number,
                contact_name: data.contact_name,
                scheduled_at: new Date().toISOString(),
                status: 'completed',
                external_call_id: callResult.callId,
                completed_at: new Date().toISOString(),
                lead_timezone: leadTimezone,
                trigger_source: 'hubspot_trigger',
                hubspot_contact_id: data.contact_id,
                metadata: data.metadata,
            })
            .select('id')
            .single();

        await logTrigger(supabase, {
            agency_id: agency.id,
            phone_number: data.phone_number,
            agent_id: agentRecord.id,
            hubspot_contact_id: data.contact_id,
            contact_name: data.contact_name,
            status: 'initiated',
            scheduled_call_id: scheduledCall?.id,
            lead_timezone: leadTimezone ?? undefined,
            request_payload: data as unknown as Record<string, unknown>,
        });

        return NextResponse.json({
            status: 'initiated',
            call_id: callResult.callId,
            lead_timezone: leadTimezone,
            agent: agentRecord.name,
        });
    } catch (error) {
        console.error('HubSpot trigger-call error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Log a trigger event to the hubspot_trigger_log table
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logTrigger(supabase: any, log: {
    agency_id: string;
    phone_number: string;
    agent_id?: string;
    hubspot_contact_id?: string;
    contact_name?: string;
    status: string;
    scheduled_call_id?: string;
    call_id?: string;
    lead_timezone?: string;
    timezone_delayed?: boolean;
    scheduled_at?: string;
    error_message?: string;
    request_payload?: Record<string, unknown>;
}) {
    try {
        await supabase.from('hubspot_trigger_log').insert(log);
    } catch (err) {
        console.error('Failed to log HubSpot trigger:', err);
    }
}
