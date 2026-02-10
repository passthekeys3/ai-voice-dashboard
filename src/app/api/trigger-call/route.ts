/**
 * Generic Outbound Trigger API
 *
 * POST /api/trigger-call
 *
 * Platform-agnostic endpoint for triggering outbound AI voice calls.
 * Designed for Make.com, n8n, Zapier, and custom HTTP integrations.
 *
 * Authentication: Bearer token API key in Authorization header.
 * The API key is generated per-agency in Settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { initiateCall } from '@/lib/calls/initiate';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { validateApiTriggerPayload } from './validate';

export async function POST(request: NextRequest) {
    try {
        // Extract Bearer token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' },
                { status: 401 },
            );
        }
        const apiKey = authHeader.slice(7); // Remove 'Bearer '

        if (!apiKey || apiKey.length < 10) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        // Parse payload
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Validate payload schema
        const validation = validateApiTriggerPayload(payload);
        if (!validation.success || !validation.data) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const data = validation.data;
        const supabase = createServiceClient();

        // Look up agency by API key
        const { data: agencies, error: agencyError } = await supabase
            .from('agencies')
            .select('id, integrations, calling_window, retell_api_key, vapi_api_key')
            .filter('integrations->api->>api_key', 'eq', apiKey);

        if (agencyError || !agencies || agencies.length === 0) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 },
            );
        }

        const agency = agencies[0];
        const apiConfig = agency.integrations?.api;

        // Verify API trigger is enabled
        if (!apiConfig?.enabled) {
            return NextResponse.json(
                { error: 'API trigger is not enabled for this agency' },
                { status: 403 },
            );
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

        if (!agentRecord && apiConfig.default_agent_id) {
            // Fall back to default agent
            agentId = apiConfig.default_agent_id;
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
                contact_name: data.contact_name,
                status: 'failed',
                error_message: 'No agent could be resolved. Provide agent_id or set a default agent in Settings.',
                request_payload: data as unknown as Record<string, unknown>,
            });
            return NextResponse.json(
                { error: 'No agent configured. Provide agent_id or set a default agent in Settings.' },
                { status: 400 },
            );
        }

        // Detect lead timezone
        const leadTimezone = detectTimezone(data.phone_number);

        // Check calling window
        const callingWindow = agency.calling_window;
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
            : agency.retell_api_key;

        if (!providerApiKey) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                contact_name: data.contact_name,
                status: 'failed',
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
                    trigger_source: 'api_trigger',
                    metadata: data.metadata,
                })
                .select('id')
                .single();

            if (schedError) {
                console.error('API trigger schedule error:', schedError);
                return NextResponse.json({ error: 'Failed to schedule call' }, { status: 500 });
            }

            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                contact_name: data.contact_name,
                status: 'scheduled',
                scheduled_call_id: scheduledCall?.id,
                request_payload: data as unknown as Record<string, unknown>,
            });

            return NextResponse.json({
                success: true,
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
                contact_name: data.contact_name,
                lead_timezone: leadTimezone,
                trigger_source: 'api_trigger',
                ...(data.metadata || {}),
            },
        });

        if (!callResult.success) {
            await logTrigger(supabase, {
                agency_id: agency.id,
                phone_number: data.phone_number,
                agent_id: agentRecord.id,
                contact_name: data.contact_name,
                status: 'failed',
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
                trigger_source: 'api_trigger',
                metadata: data.metadata,
            })
            .select('id')
            .single();

        await logTrigger(supabase, {
            agency_id: agency.id,
            phone_number: data.phone_number,
            agent_id: agentRecord.id,
            contact_name: data.contact_name,
            status: 'initiated',
            scheduled_call_id: scheduledCall?.id,
            request_payload: data as unknown as Record<string, unknown>,
        });

        return NextResponse.json({
            success: true,
            status: 'initiated',
            call_id: callResult.callId,
            lead_timezone: leadTimezone,
            agent: agentRecord.name,
        });
    } catch (error) {
        console.error('API trigger-call error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Log a trigger event to the api_trigger_log table
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logTrigger(supabase: any, log: {
    agency_id: string;
    phone_number: string;
    agent_id?: string;
    contact_name?: string;
    status: string;
    scheduled_call_id?: string;
    call_id?: string;
    error_message?: string;
    request_payload?: Record<string, unknown>;
}) {
    try {
        await supabase.from('api_trigger_log').insert(log);
    } catch (err) {
        console.error('Failed to log API trigger:', err);
    }
}
