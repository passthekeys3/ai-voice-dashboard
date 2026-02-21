import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { executeWorkflows } from '@/lib/workflows/executor';
import { broadcastCallUpdate, broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { accumulateUsage } from '@/lib/billing/usage';
import { analyzeCallTranscript, shouldAnalyzeCall } from '@/lib/analysis/call-analyzer';
import { resolveProviderApiKeys } from '@/lib/providers/resolve-keys';
import { isValidWebhookUrl } from '@/lib/webhooks/validation';
import { waitUntil } from '@vercel/functions';
import type { Workflow } from '@/types';
import Retell from 'retell-sdk';

// Retell webhook payload types
interface RetellWebhookPayload {
    event: 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated';
    call: {
        call_id: string;
        agent_id: string;
        call_type: string;
        call_status: string;
        start_timestamp: number;
        end_timestamp?: number;
        transcript?: string;
        transcript_object?: Array<{ role: string; content: string }>;
        recording_url?: string;
        from_number?: string;
        to_number?: string;
        direction?: string;
        call_analysis?: {
            call_summary?: string;
            user_sentiment?: string;
        };
        call_cost?: {
            combined_cost?: number;
            product_costs?: Array<{ product: string; cost: number; unit_price?: number }>;
        };
        metadata?: Record<string, unknown>;
    };
    // transcript_with_tool_calls is at ROOT level (not inside call) for transcript_updated events
    transcript_with_tool_calls?: Array<{ role: string; content?: string; words?: unknown[] }>;
}

// Signature verification uses the official Retell SDK's Retell.verify()
// to ensure compatibility with Retell's signature format.

// Max transcript length to store in DB (≈100k words — generous for any real call, prevents abuse)
const MAX_TRANSCRIPT_LENGTH = 500_000;

// Forward call data to agent's webhook URL
async function forwardToWebhook(webhookUrl: string, callData: Record<string, unknown>) {
    if (!isValidWebhookUrl(webhookUrl)) {
        console.error('Blocked webhook forwarding to invalid/private URL');
        return;
    }
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callData),
        });
    } catch (err) {
        console.error('Failed to forward webhook:', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('x-retell-signature');

        const payload: RetellWebhookPayload = JSON.parse(rawBody);

        // Validate event type at runtime (TypeScript union doesn't enforce this)
        const ALLOWED_EVENTS = ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated'] as const;
        if (!ALLOWED_EVENTS.includes(payload.event as typeof ALLOWED_EVENTS[number])) {
            console.warn(`[RETELL WEBHOOK] Unknown event type: ${String(payload.event)}`);
            return NextResponse.json({ received: true });
        }

        console.log(`[RETELL WEBHOOK] Received: event=${payload.event}, call=${payload.call.call_id}, agent=${payload.call.agent_id}`);

        // Use service client for webhook operations (bypasses RLS)
        const supabase = createServiceClient();

        // Find agent by external_id (include webhook_url and agency_id)
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, client_id, agency_id, webhook_url')
            .eq('external_id', payload.call.agent_id)
            .eq('provider', 'retell')
            .single();

        if (!agent) {
            console.warn(`Agent not found for Retell call: ${payload.call.agent_id}`);
            return NextResponse.json({ received: true });
        }

        // Resolve API key (client key → agency key fallback)
        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        const retellApiKey = resolvedKeys.retell_api_key;

        if (!retellApiKey) {
            console.error('Retell API key not configured - cannot verify webhook signature');
            return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
        }

        if (!Retell.verify(rawBody, retellApiKey, signature || '')) {
            console.error(`[RETELL WEBHOOK] SIGNATURE REJECTED: event=${payload.event}, call=${payload.call.call_id}`);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Handle transcript_updated event — lightweight: just update DB transcript and return
        if (payload.event === 'transcript_updated') {
            let transcript: string | undefined;

            // Primary: transcript_with_tool_calls at ROOT level of payload (NOT inside call).
            // Retell sends this at payload.transcript_with_tool_calls for transcript_updated events.
            // Contains array of utterances: {role: "agent"|"user", content: "...", words: [...]}
            if (Array.isArray(payload.transcript_with_tool_calls) && payload.transcript_with_tool_calls.length > 0) {
                transcript = payload.transcript_with_tool_calls
                    .filter(item => (item.role === 'agent' || item.role === 'user') && item.content)
                    .map(item => `${item.role === 'agent' ? 'Agent' : 'User'}: ${item.content}`)
                    .join('\n');
            }

            // Fallback 1: transcript string in call (populated after call ends / final update)
            if (!transcript) {
                transcript = payload.call.transcript;
            }

            // Fallback 2: transcript_object array in call (populated after call ends)
            if (!transcript && Array.isArray(payload.call.transcript_object)) {
                transcript = payload.call.transcript_object
                    .map(item => `${item.role === 'agent' ? 'Agent' : 'User'}: ${item.content}`)
                    .join('\n');
            }

            // Cap transcript length to prevent oversized payloads
            if (transcript && transcript.length > MAX_TRANSCRIPT_LENGTH) {
                transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
            }

            const twtcLen = Array.isArray(payload.transcript_with_tool_calls) ? payload.transcript_with_tool_calls.length : 0;
            console.log(`[RETELL WEBHOOK] transcript_updated: call=${payload.call.call_id}, twtc_items=${twtcLen}, len=${transcript?.length || 0}`);

            if (!transcript) {
                return NextResponse.json({ received: true });
            }

            const { error: updateError } = await supabase
                .from('calls')
                .update({ transcript })
                .eq('external_id', payload.call.call_id);

            if (updateError) {
                // Call record may not exist yet (race with call_started) — upsert minimal record
                await supabase
                    .from('calls')
                    .upsert({
                        agent_id: agent.id,
                        client_id: agent.client_id,
                        external_id: payload.call.call_id,
                        provider: 'retell',
                        status: 'in_progress',
                        direction: payload.call.direction || 'outbound',
                        transcript,
                        from_number: payload.call.from_number,
                        to_number: payload.call.to_number,
                        started_at: new Date(payload.call.start_timestamp).toISOString(),
                    }, { onConflict: 'external_id' });
            }

            // Broadcast transcript update via Supabase Broadcast (not postgres_changes)
            // so frontend receives it instantly without RLS blocking the notification
            waitUntil(
                broadcastTranscriptUpdate({
                    _agencyId: agent.agency_id,
                    callId: payload.call.call_id,
                    transcript,
                }).catch(err => console.error('Failed to broadcast transcript update:', err))
            );

            return NextResponse.json({ received: true });
        }

        const durationSeconds = payload.call.end_timestamp && payload.call.start_timestamp
            ? Math.round((payload.call.end_timestamp - payload.call.start_timestamp) / 1000)
            : 0;

        let status: string = 'queued';
        if (payload.call.call_status === 'ended') status = 'completed';
        else if (payload.call.call_status === 'error') status = 'failed';
        else if (payload.call.call_status === 'ongoing') status = 'in_progress';

        // Retell combined_cost is already in cents
        const costCents = Math.round(payload.call.call_cost?.combined_cost || 0);

        const direction = payload.call.direction || 'outbound';

        // Check for A/B experiment metadata (injected by traffic splitting at call initiation)
        let experimentId: string | null = null;
        let variantId: string | null = null;
        if (payload.call.metadata?.experiment_id && payload.call.metadata?.variant_id) {
            experimentId = payload.call.metadata.experiment_id as string;
            variantId = payload.call.metadata.variant_id as string;
        }

        // Cap transcript length
        const callTranscript = payload.call.transcript?.slice(0, MAX_TRANSCRIPT_LENGTH);

        // Upsert call
        const { error } = await supabase
            .from('calls')
            .upsert(
                {
                    agent_id: agent.id,
                    client_id: agent.client_id,
                    external_id: payload.call.call_id,
                    provider: 'retell',
                    status,
                    direction,
                    duration_seconds: durationSeconds,
                    cost_cents: costCents,
                    from_number: payload.call.from_number,
                    to_number: payload.call.to_number,
                    transcript: callTranscript,
                    audio_url: payload.call.recording_url,
                    summary: payload.call.call_analysis?.call_summary,
                    sentiment: payload.call.call_analysis?.user_sentiment,
                    started_at: new Date(payload.call.start_timestamp).toISOString(),
                    ended_at: payload.call.end_timestamp
                        ? new Date(payload.call.end_timestamp).toISOString()
                        : null,
                    metadata: {
                        ...(payload.call.metadata || {}),
                        ...(payload.call.call_cost?.product_costs ? { cost_breakdown: payload.call.call_cost.product_costs } : {}),
                    },
                    experiment_id: experimentId,
                    variant_id: variantId,
                },
                { onConflict: 'external_id' }
            );

        if (error) {
            console.error('Error saving Retell call:', error);
            // Return 200 to prevent webhook retry storms — log for internal investigation
            return NextResponse.json({ received: true, warning: 'Failed to save call data' });
        }

        // AI-powered call analysis (runs in background, gated behind per-client opt-in)
        if (status === 'completed' && callTranscript) {
            waitUntil((async () => {
                try {
                    // Check if client has AI analysis enabled
                    let aiEnabled = false;
                    if (agent.client_id) {
                        const { data: clientRow } = await supabase
                            .from('clients')
                            .select('ai_call_analysis')
                            .eq('id', agent.client_id)
                            .single();
                        aiEnabled = !!clientRow?.ai_call_analysis;
                    }

                    if (!shouldAnalyzeCall(aiEnabled, durationSeconds, callTranscript.length)) {
                        return;
                    }

                    const analysis = await analyzeCallTranscript(callTranscript, agent.name);
                    if (analysis) {
                        // Update the call record with AI-enriched fields
                        // Use only columns guaranteed to exist (call_score, topics, objections may not be migrated yet)
                        const { error: updateError } = await supabase
                            .from('calls')
                            .update({
                                sentiment: analysis.sentiment,
                                summary: analysis.summary,
                                metadata: {
                                    ...(payload.call.metadata || {}),
                                    ...(payload.call.call_cost?.product_costs ? { cost_breakdown: payload.call.call_cost.product_costs } : {}),
                                    ai_analysis: {
                                        sentiment_score: analysis.sentiment_score,
                                        action_items: analysis.action_items,
                                        call_outcome: analysis.call_outcome,
                                        lead_score: analysis.lead_score,
                                        topics: analysis.topics,
                                        objections: analysis.objections,
                                        analyzed_at: new Date().toISOString(),
                                    },
                                },
                            })
                            .eq('external_id', payload.call.call_id);

                        if (updateError) {
                            console.error('Failed to update call with AI analysis:', updateError);
                        }

                        // Increment agency AI analysis counter for usage tracking
                        await supabase.rpc('increment_ai_analysis_count', { agency_id_input: agent.agency_id });
                    }
                } catch (err) {
                    console.error('AI call analysis error (Retell):', err);
                }
            })());
        }

        // Broadcast real-time update to connected clients
        waitUntil(broadcastCallUpdate({
            agencyId: agent.agency_id,
            event: payload.event === 'call_started' ? 'call:started'
                 : payload.event === 'call_ended' ? 'call:ended'
                 : 'call:updated',
            call: {
                call_id: payload.call.call_id,
                external_id: payload.call.call_id,
                agent_id: agent.id,
                agent_name: agent.name,
                status: status as 'queued' | 'in_progress' | 'completed' | 'failed',
                direction: (payload.call.direction || 'outbound') as 'inbound' | 'outbound',
                from_number: payload.call.from_number,
                to_number: payload.call.to_number,
                started_at: new Date(payload.call.start_timestamp).toISOString(),
                ended_at: payload.call.end_timestamp
                    ? new Date(payload.call.end_timestamp).toISOString()
                    : undefined,
                duration_seconds: durationSeconds,
                transcript: callTranscript,
                cost_cents: costCents,
                summary: payload.call.call_analysis?.call_summary,
                sentiment: payload.call.call_analysis?.user_sentiment,
            },
        }).catch(err => console.error('Failed to broadcast call update:', err)));

        // ======================================
        // Inbound Receptionist: call_started
        // ======================================
        if (payload.event === 'call_started' && direction === 'inbound') {
            // Use waitUntil to ensure inbound processing completes after response
            waitUntil((async () => {
                try {
                    const { data: agency } = await supabase
                        .from('agencies')
                        .select('integrations')
                        .eq('id', agent.agency_id)
                        .single();

                    if (!agency) {
                        console.error('Agency not found for inbound processing:', agent.agency_id);
                        return;
                    }

                    const ghlInteg = agency.integrations?.ghl;
                    const ghlEnabled = ghlInteg?.enabled && (ghlInteg.api_key || ghlInteg.access_token);
                    const hubspotEnabled = agency.integrations?.hubspot?.enabled && agency.integrations.hubspot.access_token;

                    // Resolve GHL config once (shared between upsert + workflow)
                    let resolvedGhlConfig: { apiKey: string; locationId: string } | undefined;
                    if (ghlEnabled) {
                        if (ghlInteg!.auth_method === 'oauth' && ghlInteg!.access_token) {
                            const { getValidAccessToken: getGHLToken } = await import('@/lib/integrations/ghl');
                            const validToken = await getGHLToken(ghlInteg!, async (newTokens) => {
                                await supabase.from('agencies').update({
                                    integrations: {
                                        ...agency.integrations,
                                        ghl: { ...ghlInteg, access_token: newTokens.accessToken, refresh_token: newTokens.refreshToken, expires_at: newTokens.expiresAt },
                                    },
                                    updated_at: new Date().toISOString(),
                                }).eq('id', agent.agency_id);
                            });
                            if (validToken) resolvedGhlConfig = { apiKey: validToken, locationId: ghlInteg!.location_id || '' };
                        } else if (ghlInteg!.api_key) {
                            resolvedGhlConfig = { apiKey: ghlInteg!.api_key, locationId: ghlInteg!.location_id || '' };
                        }
                    }

                    // Resolve HubSpot config once (shared between upsert + workflow)
                    let resolvedHubspotConfig: { accessToken: string } | undefined;
                    if (hubspotEnabled) {
                        const { getValidAccessToken: getHubSpotToken } = await import('@/lib/integrations/hubspot');
                        const validToken = await getHubSpotToken(agency.integrations!.hubspot!, async (newTokens) => {
                            await supabase.from('agencies').update({
                                integrations: {
                                    ...agency.integrations,
                                    hubspot: { ...agency.integrations!.hubspot, access_token: newTokens.accessToken, refresh_token: newTokens.refreshToken, expires_at: newTokens.expiresAt },
                                },
                                updated_at: new Date().toISOString(),
                            }).eq('id', agent.agency_id);
                        });
                        if (validToken) resolvedHubspotConfig = { accessToken: validToken };
                    }

                    // Auto-create/lookup GHL contact for inbound callers
                    if (resolvedGhlConfig && payload.call.from_number) {
                        const { upsertContact } = await import('@/lib/integrations/ghl');
                        await upsertContact(resolvedGhlConfig, payload.call.from_number, {
                            source: 'BuildVoiceAI Inbound Call',
                            tags: ['inbound-call', 'ai-receptionist'],
                        });
                    }

                    // Auto-create/lookup HubSpot contact for inbound callers
                    if (resolvedHubspotConfig && payload.call.from_number) {
                        const { upsertContact: hsUpsertContact } = await import('@/lib/integrations/hubspot');
                        await hsUpsertContact(resolvedHubspotConfig, payload.call.from_number, {
                            source: 'BuildVoiceAI Inbound Call',
                            tags: ['inbound-call', 'ai-receptionist'],
                        });
                    }

                    // Execute inbound_call_started workflows
                    const { data: inboundWorkflows } = await supabase
                        .from('workflows')
                        .select('*')
                        .eq('agency_id', agent.agency_id)
                        .eq('trigger', 'inbound_call_started')
                        .eq('is_active', true)
                        .or(`agent_id.is.null,agent_id.eq.${agent.id}`);

                    if (inboundWorkflows && inboundWorkflows.length > 0) {
                        const callData = {
                            call_id: payload.call.call_id,
                            agent_id: agent.id,
                            agent_name: agent.name,
                            status,
                            direction,
                            duration_seconds: 0,
                            cost_cents: 0,
                            from_number: payload.call.from_number,
                            to_number: payload.call.to_number,
                            started_at: new Date(payload.call.start_timestamp).toISOString(),
                            metadata: payload.call.metadata,
                        };

                        // Refresh Google Calendar token if expired before passing to executor
                        let gcalConfig: { accessToken: string; calendarId: string } | undefined;
                        if (agency.integrations?.google_calendar?.enabled && agency.integrations.google_calendar.access_token) {
                            const { getValidAccessToken: getGCalToken } = await import('@/lib/integrations/gcal');
                            const validToken = await getGCalToken(agency.integrations.google_calendar, async (newTokens) => {
                                await supabase.from('agencies').update({
                                    integrations: {
                                        ...agency.integrations,
                                        google_calendar: { ...agency.integrations!.google_calendar, access_token: newTokens.accessToken, expires_at: newTokens.expiresAt },
                                    },
                                    updated_at: new Date().toISOString(),
                                }).eq('id', agent.agency_id);
                            });
                            if (validToken) {
                                gcalConfig = {
                                    accessToken: validToken,
                                    calendarId: agency.integrations.google_calendar.default_calendar_id || 'primary',
                                };
                            }
                        }

                        // Inject Slack webhook URL into metadata for executor fallback
                        if (agency.integrations?.slack?.enabled && agency.integrations.slack.webhook_url) {
                            callData.metadata = { ...callData.metadata, slack_webhook_url: agency.integrations.slack.webhook_url };
                        }

                        // Resolve Calendly config
                        const inboundCalendlyConfig = agency.integrations?.calendly?.enabled && agency.integrations.calendly.api_token
                            ? { apiToken: agency.integrations.calendly.api_token, userUri: agency.integrations.calendly.user_uri || '', defaultEventTypeUri: agency.integrations.calendly.default_event_type_uri }
                            : undefined;

                        const results = await executeWorkflows(inboundWorkflows as Workflow[], callData, resolvedGhlConfig, resolvedHubspotConfig, gcalConfig, inboundCalendlyConfig, {
                            supabase,
                            agencyId: agent.agency_id,
                        });
                        for (const result of results) {
                            if (result.actions_failed > 0) {
                                console.error(`Inbound workflow "${result.workflow_name}" errors:`, result.errors);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Inbound call_started processing error:', err);
                }
            })());
        }

        // Forward to agent's webhook if configured and call ended
        if (agent.webhook_url && payload.event === 'call_ended') {
            const webhookPayload = {
                event: 'call_ended',
                call_id: payload.call.call_id,
                agent_id: agent.id,
                status,
                direction: payload.call.direction || 'outbound',
                duration_seconds: durationSeconds,
                cost_cents: costCents,
                from_number: payload.call.from_number,
                to_number: payload.call.to_number,
                transcript: callTranscript,
                recording_url: payload.call.recording_url,
                summary: payload.call.call_analysis?.call_summary,
                sentiment: payload.call.call_analysis?.user_sentiment,
                started_at: new Date(payload.call.start_timestamp).toISOString(),
                ended_at: payload.call.end_timestamp
                    ? new Date(payload.call.end_timestamp).toISOString()
                    : null,
                metadata: payload.call.metadata,
            };

            // Use waitUntil to ensure webhook forwarding completes after response
            waitUntil(forwardToWebhook(agent.webhook_url, webhookPayload));
        }

        // Accumulate usage for per-minute billing
        if (payload.event === 'call_ended' && status === 'completed' && agent.client_id && durationSeconds > 0) {
            waitUntil((async () => {
                try {
                    const { data: client } = await supabase
                        .from('clients')
                        .select('billing_type, billing_amount_cents')
                        .eq('id', agent.client_id)
                        .single();

                    if (client?.billing_type === 'per_minute' && client.billing_amount_cents != null) {
                        const minutes = durationSeconds / 60;
                        const billableCostCents = Math.ceil(minutes * (client.billing_amount_cents || 0));
                        await accumulateUsage(supabase, {
                            clientId: agent.client_id!,
                            durationSeconds,
                            costCents: billableCostCents,
                        });
                    }
                } catch (err) {
                    console.error('Failed to accumulate usage for Retell call:', err);
                }
            })());
        }

        // Execute workflows if call ended
        if (payload.event === 'call_ended') {
            // Get agency with integrations
            const { data: agency } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', agent.agency_id)
                .single();

            if (!agency) {
                console.error('Agency not found for call_ended processing:', agent.agency_id);
                return NextResponse.json({ received: true });
            }

            // Fetch matching workflows (both generic call_ended AND direction-specific inbound_call_ended)
            const triggers = ['call_ended'];
            if (direction === 'inbound') {
                triggers.push('inbound_call_ended');
            }

            const { data: workflows } = await supabase
                .from('workflows')
                .select('*')
                .eq('agency_id', agent.agency_id)
                .in('trigger', triggers)
                .eq('is_active', true)
                .or(`agent_id.is.null,agent_id.eq.${agent.id}`);

            if (workflows && workflows.length > 0) {
                const callData = {
                    call_id: payload.call.call_id,
                    agent_id: agent.id,
                    agent_name: agent.name,
                    status,
                    direction: payload.call.direction || 'outbound',
                    duration_seconds: durationSeconds,
                    cost_cents: costCents,
                    from_number: payload.call.from_number,
                    to_number: payload.call.to_number,
                    transcript: callTranscript,
                    recording_url: payload.call.recording_url,
                    summary: payload.call.call_analysis?.call_summary,
                    sentiment: payload.call.call_analysis?.user_sentiment,
                    started_at: new Date(payload.call.start_timestamp).toISOString(),
                    ended_at: payload.call.end_timestamp
                        ? new Date(payload.call.end_timestamp).toISOString()
                        : undefined,
                    metadata: payload.call.metadata,
                };

                // Resolve GHL config with OAuth token refresh if needed
                const ghlInteg = agency.integrations?.ghl;
                let ghlConfig: { apiKey: string; locationId: string } | undefined;
                if (ghlInteg?.enabled) {
                    if (ghlInteg.auth_method === 'oauth' && ghlInteg.access_token) {
                        const { getValidAccessToken: getGHLToken } = await import('@/lib/integrations/ghl');
                        const validToken = await getGHLToken(ghlInteg, async (newTokens) => {
                            await supabase.from('agencies').update({
                                integrations: {
                                    ...agency.integrations,
                                    ghl: { ...ghlInteg, access_token: newTokens.accessToken, refresh_token: newTokens.refreshToken, expires_at: newTokens.expiresAt },
                                },
                                updated_at: new Date().toISOString(),
                            }).eq('id', agent.agency_id);
                        });
                        if (validToken) ghlConfig = { apiKey: validToken, locationId: ghlInteg.location_id || '' };
                    } else if (ghlInteg.api_key) {
                        ghlConfig = { apiKey: ghlInteg.api_key, locationId: ghlInteg.location_id || '' };
                    }
                }

                // Refresh HubSpot token if expired before passing to executor
                let hubspotConfig: { accessToken: string } | undefined;
                if (agency?.integrations?.hubspot?.enabled && agency.integrations.hubspot.access_token) {
                    const { getValidAccessToken: getHubSpotToken } = await import('@/lib/integrations/hubspot');
                    const validToken = await getHubSpotToken(agency.integrations.hubspot, async (newTokens) => {
                        await supabase.from('agencies').update({
                            integrations: {
                                ...agency.integrations,
                                hubspot: { ...agency.integrations!.hubspot, access_token: newTokens.accessToken, refresh_token: newTokens.refreshToken, expires_at: newTokens.expiresAt },
                            },
                            updated_at: new Date().toISOString(),
                        }).eq('id', agent.agency_id);
                    });
                    if (validToken) hubspotConfig = { accessToken: validToken };
                }

                // Refresh Google Calendar token if expired before passing to executor
                let gcalConfig: { accessToken: string; calendarId: string } | undefined;
                if (agency?.integrations?.google_calendar?.enabled && agency.integrations.google_calendar.access_token) {
                    const { getValidAccessToken: getGCalToken } = await import('@/lib/integrations/gcal');
                    const validToken = await getGCalToken(agency.integrations.google_calendar, async (newTokens) => {
                        await supabase.from('agencies').update({
                            integrations: {
                                ...agency.integrations,
                                google_calendar: { ...agency.integrations!.google_calendar, access_token: newTokens.accessToken, expires_at: newTokens.expiresAt },
                            },
                            updated_at: new Date().toISOString(),
                        }).eq('id', agent.agency_id);
                    });
                    if (validToken) {
                        gcalConfig = {
                            accessToken: validToken,
                            calendarId: agency.integrations.google_calendar.default_calendar_id || 'primary',
                        };
                    }
                }

                // Inject Slack webhook URL into metadata for executor fallback
                if (agency?.integrations?.slack?.enabled && agency.integrations.slack.webhook_url) {
                    callData.metadata = { ...callData.metadata, slack_webhook_url: agency.integrations.slack.webhook_url };
                }

                // Resolve Calendly config
                const calendlyConfig = agency?.integrations?.calendly?.enabled && agency.integrations.calendly.api_token
                    ? { apiToken: agency.integrations.calendly.api_token, userUri: agency.integrations.calendly.user_uri || '', defaultEventTypeUri: agency.integrations.calendly.default_event_type_uri }
                    : undefined;

                // Execute workflows with waitUntil to guarantee completion after response
                waitUntil(
                    executeWorkflows(workflows as Workflow[], callData, ghlConfig, hubspotConfig, gcalConfig, calendlyConfig, {
                        supabase,
                        agencyId: agent.agency_id,
                    })
                );
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Retell webhook error:', error);
        // Return 200 to prevent webhook retry storms — log for internal investigation
        return NextResponse.json({ received: true, warning: 'Internal error occurred' });
    }
}
