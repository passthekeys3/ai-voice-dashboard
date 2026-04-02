/**
 * Shared Trigger Call Handler
 *
 * Extracted shared logic used by all trigger-call routes:
 *   - /api/trigger-call (generic API)
 *   - /api/ghl/trigger-call (GoHighLevel)
 *   - /api/hubspot/trigger-call (HubSpot)
 *
 * Each route handles its own auth and agency lookup, then delegates
 * to handleTriggerCall() for agent resolution through call initiation.
 */

import { NextResponse } from 'next/server';
import type { VoiceProvider, CallingWindowConfig } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { initiateCall, type CallInitiationParams } from '@/lib/calls/initiate';
import { detectTimezone, isWithinCallingWindow, getNextValidCallTime } from '@/lib/timezone/detector';
import { applyExperiment } from '@/lib/experiments/apply';
import { resolveProviderApiKeys, getProviderKey, decryptAgencyKeys } from '@/lib/providers/resolve-keys';

export interface TriggerContext {
    supabase: SupabaseClient;
    agencyId: string;
    triggerSource: 'api_trigger' | 'ghl_trigger' | 'hubspot_trigger';
    triggerConfig?: { enabled?: boolean; default_agent_id?: string };
    callingWindow: CallingWindowConfig | null;
    // Validated payload fields
    phoneNumber: string;
    contactName?: string;
    agentId?: string;
    fromNumber?: string;
    scheduledAt?: string;
    metadata?: Record<string, unknown>;
    // CRM-specific fields
    crmContactId?: string;
    crmContactIdField?: string; // e.g., 'ghl_contact_id', 'hubspot_contact_id'
    logTable: string; // e.g., 'api_trigger_log', 'ghl_trigger_log', 'hubspot_trigger_log'
    // Extra metadata fields to include in call initiation (e.g., ghl_location_id, hubspot_portal_id)
    extraCallMetadata?: Record<string, unknown>;
    // Agency key resolution
    agencyKeys: {
        retell_api_key: string | null;
        vapi_api_key: string | null;
        bland_api_key: string | null;
        elevenlabs_api_key: string | null;
    };
    // Original request payload for logging
    requestPayload: Record<string, unknown>;
}

/**
 * Shared handler for all trigger-call routes.
 *
 * Executes: agent resolution -> timezone detection -> calling window check ->
 * provider key resolution -> schedule or initiate call -> log and respond.
 */
export async function handleTriggerCall(ctx: TriggerContext): Promise<NextResponse> {
    const {
        supabase,
        agencyId,
        triggerSource,
        triggerConfig,
        callingWindow,
        phoneNumber,
        contactName,
        fromNumber,
        metadata,
        crmContactId,
        crmContactIdField,
        logTable,
        extraCallMetadata,
        requestPayload,
    } = ctx;

    // Build the CRM contact ID field for scheduled_calls and log entries
    const crmFields: Record<string, string> = {};
    if (crmContactId && crmContactIdField) {
        crmFields[crmContactIdField] = crmContactId;
    }

    // ---- 1. Verify trigger is enabled (if triggerConfig provided) ----
    if (triggerConfig && !triggerConfig.enabled) {
        return NextResponse.json(
            { error: `${formatSourceLabel(triggerSource)} trigger is not enabled for this agency` },
            { status: 403 },
        );
    }

    // ---- 2. Agent resolution (3-step) ----
    let agentId = ctx.agentId;
    let agentRecord: { id: string; external_id: string; provider: string; name: string; client_id: string | null } | null = null;

    // Step 1: Explicit agent_id provided
    if (agentId) {
        const { data: agent } = await supabase
            .from('agents')
            .select('id, external_id, provider, name, client_id')
            .eq('id', agentId)
            .eq('agency_id', agencyId)
            .single();
        agentRecord = agent;
    }

    // Step 2: Fall back to default_agent_id from trigger config
    if (!agentRecord && triggerConfig?.default_agent_id) {
        agentId = triggerConfig.default_agent_id;
        const { data: agent } = await supabase
            .from('agents')
            .select('id, external_id, provider, name, client_id')
            .eq('id', agentId)
            .eq('agency_id', agencyId)
            .single();
        agentRecord = agent;
    }

    // Step 3: Fall back to outbound agent assigned to the from_number
    if (!agentRecord && fromNumber) {
        const { data: phoneNumberRecord } = await supabase
            .from('phone_numbers')
            .select('outbound_agent_id')
            .eq('phone_number', fromNumber)
            .eq('agency_id', agencyId)
            .single();

        if (phoneNumberRecord?.outbound_agent_id) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id, external_id, provider, name, client_id')
                .eq('id', phoneNumberRecord.outbound_agent_id)
                .eq('agency_id', agencyId)
                .single();
            agentRecord = agent;
        }
    }

    if (!agentRecord) {
        await logTrigger(supabase, logTable, {
            agency_id: agencyId,
            phone_number: phoneNumber,
            ...crmFields,
            contact_name: contactName,
            status: 'failed',
            error_message: 'No agent could be resolved. Provide agent_id or set a default agent in Settings.',
            request_payload: requestPayload,
        });
        return NextResponse.json(
            { error: 'No agent configured. Provide agent_id or set a default agent in Settings.' },
            { status: 400 },
        );
    }

    // ---- 3. Lead timezone detection ----
    const leadTimezone = detectTimezone(phoneNumber);

    // ---- 4. Calling window check + scheduling logic ----
    let shouldSchedule = false;
    let scheduledAt: Date | null = null;

    if (ctx.scheduledAt) {
        // Explicit schedule time provided
        scheduledAt = new Date(ctx.scheduledAt);
        shouldSchedule = true;
    } else if (callingWindow?.enabled) {
        // Check if we're within the calling window (fallback to ET if timezone unknown)
        const tz = leadTimezone || 'America/New_York';
        const windowConfig = {
            startHour: callingWindow.start_hour,
            endHour: callingWindow.end_hour,
            daysOfWeek: callingWindow.days_of_week,
        };

        if (!isWithinCallingWindow(tz, windowConfig)) {
            scheduledAt = getNextValidCallTime(tz, windowConfig);
            shouldSchedule = true;
        }
    }

    // ---- 5. Provider API key resolution ----
    const resolvedKeys = agentRecord.client_id
        ? await resolveProviderApiKeys(supabase, agencyId, agentRecord.client_id)
        : decryptAgencyKeys(ctx.agencyKeys);
    const providerApiKey = getProviderKey(resolvedKeys, agentRecord.provider as VoiceProvider);

    if (!providerApiKey) {
        await logTrigger(supabase, logTable, {
            agency_id: agencyId,
            phone_number: phoneNumber,
            agent_id: agentRecord.id,
            ...crmFields,
            contact_name: contactName,
            status: 'failed',
            lead_timezone: leadTimezone ?? undefined,
            error_message: 'Voice provider API key not configured',
            request_payload: requestPayload,
        });
        return NextResponse.json(
            { error: 'Voice provider API key not configured' },
            { status: 400 },
        );
    }

    // ---- 6. If scheduling: insert scheduled_call, log, return ----
    if (shouldSchedule && scheduledAt) {
        const { data: scheduledCall, error: schedError } = await supabase
            .from('scheduled_calls')
            .insert({
                agency_id: agencyId,
                agent_id: agentRecord.id,
                to_number: phoneNumber,
                contact_name: contactName,
                scheduled_at: scheduledAt.toISOString(),
                lead_timezone: leadTimezone,
                original_scheduled_at: ctx.scheduledAt || new Date().toISOString(),
                timezone_delayed: !ctx.scheduledAt,
                trigger_source: triggerSource,
                ...crmFields,
                metadata,
            })
            .select('id')
            .single();

        if (schedError) {
            console.error(`${triggerSource} schedule error:`, schedError.code);
            return NextResponse.json({ error: 'Failed to schedule call' }, { status: 500 });
        }

        await logTrigger(supabase, logTable, {
            agency_id: agencyId,
            phone_number: phoneNumber,
            agent_id: agentRecord.id,
            ...crmFields,
            contact_name: contactName,
            status: 'scheduled',
            scheduled_call_id: scheduledCall?.id,
            lead_timezone: leadTimezone ?? undefined,
            timezone_delayed: !ctx.scheduledAt,
            scheduled_at: scheduledAt.toISOString(),
            request_payload: requestPayload,
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

    // ---- 7. Immediate call: A/B experiment, initiateCall, tracking, log ----
    let callInitParams: CallInitiationParams = {
        provider: agentRecord.provider as VoiceProvider,
        providerApiKey,
        externalAgentId: agentRecord.external_id,
        toNumber: phoneNumber,
        fromNumber,
        metadata: {
            ...crmFields,
            ...(extraCallMetadata || {}),
            contact_name: contactName,
            lead_timezone: leadTimezone,
            trigger_source: triggerSource,
            ...(metadata || {}),
        },
    };

    // Apply A/B experiment traffic splitting (if a running experiment exists for this agent)
    const experimentResult = await applyExperiment({
        agentId: agentRecord.id,
        agencyId,
        callParams: callInitParams,
    });
    callInitParams = experimentResult.callParams;

    const callResult = await initiateCall(callInitParams);

    if (!callResult.success) {
        await logTrigger(supabase, logTable, {
            agency_id: agencyId,
            phone_number: phoneNumber,
            agent_id: agentRecord.id,
            ...crmFields,
            contact_name: contactName,
            status: 'failed',
            lead_timezone: leadTimezone ?? undefined,
            error_message: callResult.error,
            request_payload: requestPayload,
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
            agency_id: agencyId,
            agent_id: agentRecord.id,
            to_number: phoneNumber,
            contact_name: contactName,
            scheduled_at: new Date().toISOString(),
            status: 'completed',
            external_call_id: callResult.callId,
            completed_at: new Date().toISOString(),
            lead_timezone: leadTimezone,
            trigger_source: triggerSource,
            ...crmFields,
            metadata,
        })
        .select('id')
        .single();

    await logTrigger(supabase, logTable, {
        agency_id: agencyId,
        phone_number: phoneNumber,
        agent_id: agentRecord.id,
        ...crmFields,
        contact_name: contactName,
        status: 'initiated',
        scheduled_call_id: scheduledCall?.id,
        lead_timezone: leadTimezone ?? undefined,
        request_payload: requestPayload,
    });

    return NextResponse.json({
        success: true,
        status: 'initiated',
        call_id: callResult.callId,
        lead_timezone: leadTimezone,
        agent: agentRecord.name,
    });
}

/**
 * Log a trigger event to the specified log table.
 */
async function logTrigger(
    supabase: SupabaseClient,
    table: string,
    log: Record<string, unknown>,
): Promise<void> {
    try {
        await supabase.from(table).insert(log);
    } catch (err) {
        console.error(`Failed to log trigger to ${table}:`, err instanceof Error ? err.message : 'Unknown');
    }
}

/**
 * Format trigger source for user-facing error messages.
 */
function formatSourceLabel(source: string): string {
    switch (source) {
        case 'api_trigger': return 'API';
        case 'ghl_trigger': return 'GHL';
        case 'hubspot_trigger': return 'HubSpot';
        default: return source;
    }
}
