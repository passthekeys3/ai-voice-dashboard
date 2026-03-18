/**
 * Shared webhook post-processing pipeline.
 *
 * Called by all 3 provider webhook handlers (Retell, Vapi, Bland) after
 * they parse, verify, dedup, and upsert the call record. This module
 * handles the provider-agnostic work: AI analysis, realtime broadcast,
 * webhook forwarding, billing, CRM integration, and workflow execution.
 *
 * Each function is fire-and-forget (wrapped in waitUntil by the caller)
 * so the webhook response is not delayed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { broadcastCallUpdate, broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { forwardToWebhook } from '@/lib/webhooks/forward';
import { accumulateUsage } from '@/lib/billing/usage';
import { analyzeCallTranscript, shouldAnalyzeCall } from '@/lib/analysis/call-analyzer';
import { resolveIntegrations, createTokenRefreshCallback } from '@/lib/integrations/resolve';
import { executeWorkflows } from '@/lib/workflows/executor';
import { waitUntil } from '@vercel/functions';
import type { Workflow } from '@/types';

// ── Normalized call interface ────────────────────────────
// All 3 providers map their payloads into this shape before calling the pipeline.

export interface ProcessedCall {
    callId: string;
    agentId: string;
    agentName: string;
    agencyId: string;
    clientId: string | null;
    provider: 'retell' | 'vapi' | 'bland';
    status: string;
    direction: 'inbound' | 'outbound';
    durationSeconds: number;
    costCents: number;
    fromNumber?: string;
    toNumber?: string;
    startedAt: string;
    endedAt?: string;
    transcript?: string;
    recordingUrl?: string;
    summary?: string;
    sentiment?: string;
    metadata?: Record<string, unknown>;
    isCallStarted: boolean;
    isCallEnded: boolean;
    isVoicemail?: boolean;
    agentWebhookUrl?: string;
    resolvedKeySource: Record<string, string>;
}

// ── Main entry point ─────────────────────────────────────

/**
 * Run all post-processing steps after a call record has been upserted.
 * All steps are fire-and-forget via waitUntil — the webhook response
 * is returned immediately by the caller.
 */
export function runPostProcessingPipeline(
    supabase: SupabaseClient,
    call: ProcessedCall,
): void {
    // 1. AI analysis (gated behind client opt-in + call quality checks)
    if (call.isCallEnded && call.status === 'completed' && call.transcript && !call.isVoicemail) {
        waitUntil(runAIAnalysis(supabase, call));
    }

    // 2. Realtime broadcast to connected dashboard users
    waitUntil(broadcastUpdate(call));

    // 3. Forward to per-agent webhook (if configured)
    if (call.agentWebhookUrl && (call.isCallStarted || call.isCallEnded)) {
        waitUntil(forwardToAgentWebhook(supabase, call));
    }

    // 4. Per-minute billing for client
    if (call.isCallEnded && call.status === 'completed' && call.clientId && call.durationSeconds > 0) {
        waitUntil(accumulateClientBilling(supabase, call));
    }

    // 5. Platform metered billing (when using our API keys)
    const providerSource = call.resolvedKeySource[call.provider];
    if (call.isCallEnded && call.status === 'completed' && call.durationSeconds > 0 && providerSource === 'platform') {
        waitUntil(reportPlatformUsage(supabase, call));
    }

    // 6. Inbound call started: CRM contact upsert + inbound workflows
    if (call.isCallStarted && call.direction === 'inbound') {
        waitUntil(processInboundStarted(supabase, call));
    }

    // 7. Forward call_started to client/agency API webhook
    if (call.isCallStarted) {
        waitUntil(forwardToApiWebhook(supabase, call, 'started'));
    }

    // 8. Call ended: workflows + client/agency API webhook
    if (call.isCallEnded) {
        waitUntil(processCallEnded(supabase, call));
    }
}

// ── AI Analysis ──────────────────────────────────────────

async function runAIAnalysis(supabase: SupabaseClient, call: ProcessedCall): Promise<void> {
    try {
        let aiEnabled = false;
        if (call.clientId) {
            const { data: clientRow } = await supabase
                .from('clients')
                .select('ai_call_analysis')
                .eq('id', call.clientId)
                .single();
            aiEnabled = !!clientRow?.ai_call_analysis;
        }

        if (!shouldAnalyzeCall(aiEnabled, call.durationSeconds, call.transcript!.length)) return;

        const analysis = await analyzeCallTranscript(call.transcript!, call.agentName);
        if (!analysis) return;

        const { data: currentCall } = await supabase
            .from('calls')
            .select('metadata')
            .eq('external_id', call.callId)
            .single();

        const { error } = await supabase
            .from('calls')
            .update({
                sentiment: analysis.sentiment,
                summary: analysis.summary,
                topics: analysis.topics,
                objections: analysis.objections,
                metadata: {
                    ...((currentCall?.metadata as Record<string, unknown>) || {}),
                    ai_analysis: {
                        sentiment_score: analysis.sentiment_score,
                        action_items: analysis.action_items,
                        call_outcome: analysis.call_outcome,
                        lead_score: analysis.lead_score,
                        analyzed_at: new Date().toISOString(),
                    },
                },
            })
            .eq('external_id', call.callId);

        if (error) {
            console.error(`Failed to update ${call.provider} call with AI analysis:`, error.code);
        }

        await supabase.rpc('increment_ai_analysis_count', { agency_id_input: call.agencyId });
    } catch (err) {
        console.error(`AI call analysis error (${call.provider}):`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Realtime Broadcast ───────────────────────────────────

async function broadcastUpdate(call: ProcessedCall): Promise<void> {
    try {
        const event = call.isCallStarted ? 'call:started'
            : call.isCallEnded ? 'call:ended'
            : 'call:updated';

        await broadcastCallUpdate({
            agencyId: call.agencyId,
            event,
            call: {
                call_id: call.callId,
                external_id: call.callId,
                agent_id: call.agentId,
                agent_name: call.agentName,
                status: call.status as 'queued' | 'in_progress' | 'completed' | 'failed',
                direction: call.direction,
                from_number: call.fromNumber,
                to_number: call.toNumber,
                started_at: call.startedAt,
                ended_at: call.endedAt,
                duration_seconds: call.durationSeconds,
                transcript: call.transcript,
                cost_cents: call.costCents,
                summary: call.summary,
                sentiment: call.sentiment,
            },
        });
    } catch (err) {
        console.error(`Failed to broadcast ${call.provider} call update:`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Per-Agent Webhook Forwarding ─────────────────────────

async function forwardToAgentWebhook(supabase: SupabaseClient, call: ProcessedCall): Promise<void> {
    const eventName = call.isCallStarted ? 'call_started' : 'call_ended';
    const payload: Record<string, unknown> = {
        event: eventName,
        call_id: call.callId,
        agent_id: call.agentId,
        agent_name: call.agentName,
        status: call.status,
        direction: call.direction,
        duration_seconds: call.durationSeconds,
        cost_cents: call.costCents,
        from_number: call.fromNumber,
        to_number: call.toNumber,
        started_at: call.startedAt,
        ended_at: call.endedAt,
        metadata: call.metadata,
        provider: call.provider,
        ...(call.isCallEnded ? {
            transcript: call.transcript,
            recording_url: call.recordingUrl,
            summary: call.summary,
            sentiment: call.sentiment,
        } : {}),
    };

    await forwardToWebhook(supabase, {
        webhookUrl: call.agentWebhookUrl!,
        payload,
        agencyId: call.agencyId,
        callId: call.callId,
        event: eventName,
    });
}

// ── Client/Agency API Webhook Forwarding ─────────────────

async function forwardToApiWebhook(
    supabase: SupabaseClient,
    call: ProcessedCall,
    phase: 'started' | 'ended',
): Promise<void> {
    try {
        const { integrations } = await resolveIntegrations(supabase, call.agencyId, call.clientId);
        if (!integrations.api?.enabled || !integrations.api.webhook_url) return;

        const dirPrefix = call.direction === 'inbound' ? 'inbound_' : '';
        const eventName = `${dirPrefix}call_${phase}`;

        const payload: Record<string, unknown> = {
            event: eventName,
            call_id: call.callId,
            agent_id: call.agentId,
            agent_name: call.agentName,
            status: call.status,
            direction: call.direction,
            from_number: call.fromNumber,
            to_number: call.toNumber,
            started_at: call.startedAt,
            ended_at: call.endedAt,
            metadata: call.metadata,
            provider: call.provider,
            ...(phase === 'ended' ? {
                duration_seconds: call.durationSeconds,
                cost_cents: call.costCents,
                transcript: call.transcript,
                recording_url: call.recordingUrl,
                summary: call.summary,
                sentiment: call.sentiment,
            } : {}),
        };

        await forwardToWebhook(supabase, {
            webhookUrl: integrations.api.webhook_url,
            payload,
            signingSecret: integrations.api.webhook_signing_secret,
            agencyId: call.agencyId,
            callId: call.callId,
            event: eventName,
        });
    } catch (err) {
        console.error(`${call.provider} call_${phase} API webhook error:`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Client Per-Minute Billing ────────────────────────────

async function accumulateClientBilling(supabase: SupabaseClient, call: ProcessedCall): Promise<void> {
    try {
        const { data: client } = await supabase
            .from('clients')
            .select('billing_type, billing_amount_cents')
            .eq('id', call.clientId)
            .single();

        if (client?.billing_type === 'per_minute' && client.billing_amount_cents != null) {
            const minutes = call.durationSeconds / 60;
            const billableCostCents = Math.ceil(minutes * (client.billing_amount_cents || 0));
            await accumulateUsage(supabase, {
                clientId: call.clientId!,
                durationSeconds: call.durationSeconds,
                costCents: billableCostCents,
            });
        }
    } catch (err) {
        console.error(`Failed to accumulate usage for ${call.provider} call:`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Platform Metered Billing (Stripe) ────────────────────

async function reportPlatformUsage(supabase: SupabaseClient, call: ProcessedCall): Promise<void> {
    try {
        const { data: agencyRow } = await supabase
            .from('agencies')
            .select('stripe_customer_id')
            .eq('id', call.agencyId)
            .single();

        if (agencyRow?.stripe_customer_id) {
            const { reportMeteredUsage } = await import('@/lib/billing/metered');
            await reportMeteredUsage({
                stripeCustomerId: agencyRow.stripe_customer_id,
                minutes: call.durationSeconds / 60,
                timestamp: Math.floor(new Date(call.endedAt || Date.now()).getTime() / 1000),
                identifier: `${call.provider}_call_${call.callId}`,
            });
        }
    } catch (err) {
        console.error(`Failed to report metered usage for ${call.provider} call:`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Integration Config Resolution ────────────────────────
// Shared helper to resolve all CRM/calendar configs in one place.

interface ResolvedConfigs {
    ghl?: { apiKey: string; locationId: string };
    hubspot?: { accessToken: string };
    gcal?: { accessToken: string; calendarId: string };
    calendly?: { apiToken: string; userUri: string; defaultEventTypeUri?: string };
    slackWebhookUrl?: string;
}

async function resolveAllIntegrationConfigs(
    supabase: SupabaseClient,
    call: ProcessedCall,
): Promise<ResolvedConfigs> {
    const { integrations, source: integrationSource } = await resolveIntegrations(
        supabase, call.agencyId, call.clientId,
    );
    const configs: ResolvedConfigs = {};

    // GHL
    const ghlInteg = integrations.ghl;
    if (ghlInteg?.enabled) {
        if (ghlInteg.auth_method === 'oauth' && ghlInteg.access_token) {
            const { getValidAccessToken } = await import('@/lib/integrations/ghl');
            const token = await getValidAccessToken(ghlInteg, createTokenRefreshCallback(
                supabase, call.agencyId, call.clientId, 'ghl', integrationSource.ghl ?? 'agency',
            ));
            if (token) configs.ghl = { apiKey: token, locationId: ghlInteg.location_id || '' };
        } else if (ghlInteg.api_key) {
            configs.ghl = { apiKey: ghlInteg.api_key, locationId: ghlInteg.location_id || '' };
        }
    }

    // HubSpot
    if (integrations.hubspot?.enabled && integrations.hubspot.access_token) {
        const { getValidAccessToken } = await import('@/lib/integrations/hubspot');
        const token = await getValidAccessToken(integrations.hubspot, createTokenRefreshCallback(
            supabase, call.agencyId, call.clientId, 'hubspot', integrationSource.hubspot ?? 'agency',
        ));
        if (token) configs.hubspot = { accessToken: token };
    }

    // Google Calendar
    if (integrations.google_calendar?.enabled && integrations.google_calendar.access_token) {
        const { getValidAccessToken } = await import('@/lib/integrations/gcal');
        const token = await getValidAccessToken(integrations.google_calendar, createTokenRefreshCallback(
            supabase, call.agencyId, call.clientId, 'google_calendar', integrationSource.google_calendar ?? 'agency',
        ));
        if (token) {
            configs.gcal = {
                accessToken: token,
                calendarId: integrations.google_calendar.default_calendar_id || 'primary',
            };
        }
    }

    // Calendly
    if (integrations.calendly?.enabled && integrations.calendly.api_token) {
        configs.calendly = {
            apiToken: integrations.calendly.api_token,
            userUri: integrations.calendly.user_uri || '',
            defaultEventTypeUri: integrations.calendly.default_event_type_uri,
        };
    }

    // Slack
    if (integrations.slack?.enabled && integrations.slack.webhook_url) {
        configs.slackWebhookUrl = integrations.slack.webhook_url;
    }

    return configs;
}

// ── Inbound Call Started Processing ──────────────────────

async function processInboundStarted(supabase: SupabaseClient, call: ProcessedCall): Promise<void> {
    try {
        const configs = await resolveAllIntegrationConfigs(supabase, call);

        // Auto-create/lookup CRM contacts for inbound callers
        if (configs.ghl && call.fromNumber) {
            const { upsertContact } = await import('@/lib/integrations/ghl');
            await upsertContact(configs.ghl, call.fromNumber, {
                source: 'BuildVoiceAI Inbound Call',
                tags: ['inbound-call', 'ai-receptionist'],
            });
        }

        if (configs.hubspot && call.fromNumber) {
            const { upsertContact } = await import('@/lib/integrations/hubspot');
            await upsertContact(configs.hubspot, call.fromNumber, {
                source: 'BuildVoiceAI Inbound Call',
                tags: ['inbound-call', 'ai-receptionist'],
            });
        }

        // Execute inbound_call_started workflows
        const { data: workflows } = await supabase
            .from('workflows')
            .select('*')
            .eq('agency_id', call.agencyId)
            .eq('trigger', 'inbound_call_started')
            .eq('is_active', true)
            .or(`agent_id.is.null,agent_id.eq.${call.agentId}`);

        if (workflows && workflows.length > 0) {
            const callData = buildWorkflowCallData(call);
            if (configs.slackWebhookUrl) {
                callData.metadata = { ...(callData.metadata || {}), slack_webhook_url: configs.slackWebhookUrl };
            }

            const results = await executeWorkflows(
                workflows as Workflow[], callData,
                configs.ghl, configs.hubspot, configs.gcal, configs.calendly,
                { supabase, agencyId: call.agencyId },
            );
            for (const result of results) {
                if (result.actions_failed > 0) {
                    console.error(`${call.provider} inbound workflow "${result.workflow_name}" errors:`, result.errors);
                }
            }
        }
    } catch (err) {
        console.error(`${call.provider} inbound call_started processing error:`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Call Ended Processing ────────────────────────────────

async function processCallEnded(supabase: SupabaseClient, call: ProcessedCall): Promise<void> {
    try {
        const configs = await resolveAllIntegrationConfigs(supabase, call);

        // Forward to client/agency API webhook
        await forwardToApiWebhook(supabase, call, 'ended');

        // Auto-create/lookup CRM contacts for inbound callers (on end too)
        if (call.direction === 'inbound') {
            if (configs.ghl && call.fromNumber) {
                const { upsertContact } = await import('@/lib/integrations/ghl');
                await upsertContact(configs.ghl, call.fromNumber, {
                    source: 'BuildVoiceAI Inbound Call',
                    tags: ['inbound-call', 'ai-receptionist'],
                });
            }
            if (configs.hubspot && call.fromNumber) {
                const { upsertContact } = await import('@/lib/integrations/hubspot');
                await upsertContact(configs.hubspot, call.fromNumber, {
                    source: 'BuildVoiceAI Inbound Call',
                    tags: ['inbound-call', 'ai-receptionist'],
                });
            }
        }

        // Fetch matching workflows
        const triggers = ['call_ended'];
        if (call.direction === 'inbound') triggers.push('inbound_call_ended');

        const { data: workflows } = await supabase
            .from('workflows')
            .select('*')
            .eq('agency_id', call.agencyId)
            .in('trigger', triggers)
            .eq('is_active', true)
            .or(`agent_id.is.null,agent_id.eq.${call.agentId}`);

        if (workflows && workflows.length > 0) {
            const callData = buildWorkflowCallData(call);
            if (configs.slackWebhookUrl) {
                callData.metadata = { ...(callData.metadata || {}), slack_webhook_url: configs.slackWebhookUrl };
            }

            const results = await executeWorkflows(
                workflows as Workflow[], callData,
                configs.ghl, configs.hubspot, configs.gcal, configs.calendly,
                { supabase, agencyId: call.agencyId },
            );
            for (const result of results) {
                if (result.actions_failed > 0) {
                    console.error(`${call.provider} workflow "${result.workflow_name}" errors:`, result.errors);
                }
            }
        }
    } catch (err) {
        console.error(`${call.provider} workflow processing error:`, err instanceof Error ? err.message : 'Unknown error');
    }
}

// ── Shared call data builder for workflow executor ───────

function buildWorkflowCallData(call: ProcessedCall) {
    return {
        call_id: call.callId,
        agent_id: call.agentId,
        agent_name: call.agentName,
        status: call.status,
        direction: call.direction,
        duration_seconds: call.durationSeconds,
        cost_cents: call.costCents,
        from_number: call.fromNumber,
        to_number: call.toNumber,
        transcript: call.transcript,
        recording_url: call.recordingUrl,
        summary: call.summary,
        sentiment: call.sentiment,
        started_at: call.startedAt,
        ended_at: call.endedAt,
        metadata: (call.metadata || {}) as Record<string, unknown>,
    };
}

// Re-export for use by transcript handlers
export { broadcastTranscriptUpdate };
