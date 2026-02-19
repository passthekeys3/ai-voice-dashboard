/**
 * GHL Outbound Trigger Webhook
 *
 * POST /api/ghl/trigger-call
 *
 * Receives webhook POSTs from GoHighLevel workflows to initiate
 * outbound AI voice calls. Supports timezone-aware scheduling.
 *
 * Authentication: HMAC-SHA256 signature in x-ghl-signature header,
 * verified against the per-agency webhook secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { initiateCall, type CallInitiationParams } from '@/lib/calls/initiate';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { verifyGHLTriggerSignature, validateGHLTriggerPayload } from './validate';
import { applyExperiment } from '@/lib/experiments/apply';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-ghl-signature');

        // Parse payload
        let payload: unknown;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Validate payload schema
        const validation = validateGHLTriggerPayload(payload);
        if (!validation.success || !validation.data) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const data = validation.data;
        const supabase = createServiceClient();

        // Look up agency by GHL location_id
        const { data: agencies, error: agencyError } = await supabase
            .from('agencies')
            .select('id, integrations, calling_window, retell_api_key, vapi_api_key, bland_api_key')
            .filter('integrations->ghl->>location_id', 'eq', data.location_id);

        if (agencyError || !agencies || agencies.length === 0) {
            return NextResponse.json(
                { error: 'No agency found for this location_id' },
                { status: 404 },
            );
        }

        const agency = agencies[0];
        const ghlConfig = agency.integrations?.ghl;
        const triggerConfig = ghlConfig?.trigger_config;

        // Verify trigger is enabled
        if (!triggerConfig?.enabled) {
            return NextResponse.json(
                { error: 'GHL trigger is not enabled for this agency' },
                { status: 403 },
            );
        }

        // Verify webhook signature
        if (!verifyGHLTriggerSignature(rawBody, signature, triggerConfig.webhook_secret)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Resolve which agent to use
        let agentId = data.agent_id;
        let agentRecord: { id: string; external_id: string; provider: string; name: string } | null = null;

        if (agentId) {
            // Explicit agent_id provided
            const { data: agent } = await supabase
                .from('agents')
                .select('id, external_id, provider, name')
                .eq('id', agentId)
                .eq('agency_id', agency.id)
                .single();
            agentRecord = agent;
        }

        if (!agentRecord && triggerConfig.default_agent_id) {
            // Fall back to default agent
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
            // Fall back to outbound agent assigned to the from_number
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
                ghl_contact_id: data.contact_id,
                contact_name: data.contact_name,
                status: 'failed',
                error_message: 'No agent could be resolved. Configure a default agent in GHL trigger settings.',
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
        const callingWindow = agency.calling_window ?? ghlConfig?.calling_window;
        let shouldSchedule = false;
        let scheduledAt: Date | null = null;

        if (data.scheduled_at) {
            // Explicit schedule time provided
            scheduledAt = new Date(data.scheduled_at);
            shouldSchedule = true;
        } else if (callingWindow?.enabled && leadTimezone) {
            // Check if we're within the calling window
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
            : agentRecord.provider === 'bland'
            ? agency.bland_api_key
            : agency.retell_api_key;

        if (!providerApiKey) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                ghl_contact_id: data.contact_id,
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
                    timezone_delayed: !data.scheduled_at, // Only if auto-delayed (not explicitly scheduled)
                    trigger_source: 'ghl_trigger',
                    ghl_contact_id: data.contact_id,
                    metadata: data.metadata,
                })
                .select('id')
                .single();

            if (schedError) {
                console.error('GHL trigger schedule error:', schedError);
                return NextResponse.json({ error: 'Failed to schedule call' }, { status: 500 });
            }

            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                ghl_contact_id: data.contact_id,
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
                ghl_contact_id: data.contact_id,
                ghl_location_id: data.location_id,
                contact_name: data.contact_name,
                lead_timezone: leadTimezone,
                trigger_source: 'ghl_trigger',
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
                ghl_contact_id: data.contact_id,
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

        // Also insert into scheduled_calls as completed for tracking
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
                trigger_source: 'ghl_trigger',
                ghl_contact_id: data.contact_id,
                metadata: data.metadata,
            })
            .select('id')
            .single();

        await logTrigger(supabase, {
            agency_id: agency.id,
            phone_number: data.phone_number,
            agent_id: agentRecord.id,
            ghl_contact_id: data.contact_id,
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
        console.error('GHL trigger-call error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Log a trigger event to the ghl_trigger_log table
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logTrigger(supabase: any, log: {
    agency_id: string;
    phone_number: string;
    agent_id?: string;
    ghl_contact_id?: string;
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
        await supabase.from('ghl_trigger_log').insert(log);
    } catch (err) {
        console.error('Failed to log GHL trigger:', err);
    }
}
