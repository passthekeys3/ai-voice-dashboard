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
import { initiateCall, type CallInitiationParams } from '@/lib/calls/initiate';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { verifyHubSpotTriggerSignature, validateHubSpotTriggerPayload } from './validate';
import { applyExperiment } from '@/lib/experiments/apply';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';

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
            .select('id, integrations, calling_window, retell_api_key, vapi_api_key, bland_api_key')
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

        // Reject stale timestamps to prevent replay attacks (5-minute window)
        if (timestamp) {
            const timestampMs = parseInt(timestamp, 10);
            if (!isNaN(timestampMs) && Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
                return NextResponse.json({ error: 'Request timestamp too old' }, { status: 401 });
            }
        }

        // Resolve which agent to use
        let agentId = data.agent_id;
        let agentRecord: { id: string; external_id: string; provider: string; name: string; client_id: string | null } | null = null;

        if (agentId) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id, external_id, provider, name, client_id')
                .eq('id', agentId)
                .eq('agency_id', agency.id)
                .single();
            agentRecord = agent;
        }

        if (!agentRecord && triggerConfig.default_agent_id) {
            agentId = triggerConfig.default_agent_id;
            const { data: agent } = await supabase
                .from('agents')
                .select('id, external_id, provider, name, client_id')
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
                    .select('id, external_id, provider, name, client_id')
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

        // Resolve provider API key (client key → agency key fallback)
        const resolvedKeys = agentRecord.client_id
            ? await resolveProviderApiKeys(supabase, agency.id, agentRecord.client_id)
            : {
                retell_api_key: agency.retell_api_key || null,
                vapi_api_key: agency.vapi_api_key || null,
                bland_api_key: agency.bland_api_key || null,
                source: { retell: 'agency' as const, vapi: 'agency' as const, bland: 'agency' as const },
            };
        const providerApiKey = getProviderKey(resolvedKeys, agentRecord.provider as 'retell' | 'vapi' | 'bland');

        if (!providerApiKey) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                hubspot_contact_id: data.contact_id,
                contact_name: data.contact_name,
                status: 'failed',
                lead_timezone: leadTimezone ?? undefined,
                error_message: 'Voice provider API key not configured',
                request_payload: data as unknown as Record<string, unknown>,
            });
            return NextResponse.json(
                { error: 'Voice provider API key not configured' },
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
                console.error('HubSpot trigger schedule error:', schedError.code);
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

        // Call immediately — resolve A/B experiment before initiating
        let callInitParams: CallInitiationParams = {
            provider: agentRecord.provider as 'retell' | 'vapi' | 'bland',
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
        };

        // Apply A/B experiment traffic splitting (if a running experiment exists for this agent)
        const experimentResult = await applyExperiment({
            agentId: agentRecord.id,
            agencyId: agency.id,
            callParams: callInitParams,
        });
        callInitParams = experimentResult.callParams;

        const callResult = await initiateCall(callInitParams);

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
        console.error('HubSpot trigger-call error:', error instanceof Error ? error.message : 'Unknown error');
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
        console.error('Failed to log HubSpot trigger:', err instanceof Error ? err.message : 'Unknown error');
    }
}
