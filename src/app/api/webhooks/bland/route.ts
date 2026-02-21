import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { executeWorkflows } from '@/lib/workflows/executor';
import { broadcastCallUpdate } from '@/lib/realtime/broadcast';
import { detectTimezone } from '@/lib/timezone/detector';
import { accumulateUsage } from '@/lib/billing/usage';
import { calculateCallScore } from '@/lib/scoring/call-score';
import { analyzeCallTranscript, shouldAnalyzeCall } from '@/lib/analysis/call-analyzer';
import { resolveProviderApiKeys } from '@/lib/providers/resolve-keys';
import { isValidWebhookUrl } from '@/lib/webhooks/validation';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';
import type { Workflow } from '@/types';

// Max transcript length to store in DB (≈100k words — generous for any real call, prevents abuse)
const MAX_TRANSCRIPT_LENGTH = 500_000;

// Verify Bland webhook signature using HMAC-SHA256 (same pattern as Vapi).
// The webhook secret is derived from the agency's Bland API key.
function verifyBlandSignature(body: string, signature: string | null, apiKey: string): boolean {
    if (!signature) return false;

    try {
        const hash = crypto
            .createHmac('sha256', apiKey)
            .update(body)
            .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
    } catch {
        return false;
    }
}

// Bland.ai webhook payload
// Bland fires the webhook URL set per-call (not per-agent).
interface BlandWebhookPayload {
    call_id: string;
    c_id?: string;
    pathway_id?: string;
    to: string;
    from?: string;
    status: string;
    completed: boolean;
    call_length?: number;       // Duration in MINUTES
    price?: number;             // Cost in DOLLARS
    answered_by?: string;       // 'human' | 'voicemail' | null
    summary?: string;
    recording_url?: string;
    concatenated_transcript?: string;
    transcripts?: Array<{
        id: number;
        created_at: string;
        text: string;
        user: 'assistant' | 'user';
    }>;
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    error_message?: string;
    created_at: string;
    started_at?: string;
    end_at?: string;
}

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
        console.error('Failed to forward Bland webhook:', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const payload: BlandWebhookPayload = JSON.parse(rawBody);

        const supabase = createServiceClient();

        // Bland uses pathway_id as the agent identifier
        const pathwayId = payload.pathway_id || (payload.metadata?.pathway_id as string);

        if (!pathwayId) {
            // Bland calls without a pathway_id can't be mapped to an agent
            console.warn(`Bland webhook received without pathway_id for call: ${payload.call_id}`);
            return NextResponse.json({ received: true });
        }

        // Find agent by external_id (pathway_id) + provider = 'bland'
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, client_id, agency_id, webhook_url')
            .eq('external_id', pathwayId)
            .eq('provider', 'bland')
            .single();

        if (!agent) {
            console.warn(`Agent not found for Bland pathway: ${pathwayId}`);
            return NextResponse.json({ received: true });
        }

        // Resolve API key (client key → agency key fallback)
        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        const blandApiKey = resolvedKeys.bland_api_key;

        if (!blandApiKey) {
            console.error('Bland API key not configured — rejecting webhook');
            return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
        }

        // Verify webhook signature (required)
        const blandSignature = request.headers.get('x-bland-signature');
        if (!blandSignature) {
            console.error('Bland webhook received without signature — rejecting');
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }
        if (!verifyBlandSignature(rawBody, blandSignature, blandApiKey)) {
            console.error('Invalid Bland webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Convert Bland units
        const durationSeconds = payload.call_length
            ? Math.round(payload.call_length * 60)
            : 0;
        const costCents = payload.price
            ? Math.round(payload.price * 100)
            : 0;

        let status: string = 'queued';
        if (payload.completed || payload.status === 'completed' || payload.status === 'complete') {
            status = 'completed';
        } else if (payload.status === 'in-progress' || payload.status === 'ongoing') {
            status = 'in_progress';
        } else if (payload.status === 'error') {
            status = 'failed';
        }

        // Detect inbound direction: Bland inbound calls may set direction in metadata,
        // or the agency's own number appears as `from` for outbound and `to` for inbound.
        const direction = (payload.metadata?.direction === 'inbound') ? 'inbound' : 'outbound';

        // Detect lead timezone from phone number
        const leadPhone = payload.to;
        const leadTimezone = leadPhone ? detectTimezone(leadPhone) : null;

        // Check for A/B experiment metadata
        let experimentId: string | null = null;
        let variantId: string | null = null;
        if (payload.metadata?.experiment_id && payload.metadata?.variant_id) {
            experimentId = payload.metadata.experiment_id as string;
            variantId = payload.metadata.variant_id as string;
        }

        // Detect voicemail calls — Bland provides answered_by: 'human' | 'voicemail' | null
        const isVoicemail = payload.answered_by === 'voicemail';

        // Calculate call quality score (voicemail = 0, not a meaningful interaction)
        const callScore = status === 'completed'
            ? (isVoicemail ? 0 : calculateCallScore({
                sentiment: undefined,
                durationSeconds,
                status,
            }))
            : null;

        // Build timestamps
        const startedAt = payload.started_at || payload.created_at || new Date().toISOString();
        const endedAt = payload.end_at || null;

        // Prefer structured transcripts array (speaker-attributed) over flat string.
        // Formats into "Agent: ...\nUser: ..." matching Retell/Vapi parseTranscript() expectations.
        let transcript: string | undefined;
        if (payload.transcripts && payload.transcripts.length > 0) {
            transcript = payload.transcripts
                .map(t => `${t.user === 'assistant' ? 'Agent' : 'User'}: ${t.text}`)
                .join('\n');
        } else {
            transcript = payload.concatenated_transcript || undefined;
        }

        // Cap transcript length to prevent oversized payloads
        if (transcript && transcript.length > MAX_TRANSCRIPT_LENGTH) {
            transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
        }

        // Upsert call
        const { error } = await supabase
            .from('calls')
            .upsert(
                {
                    agent_id: agent.id,
                    client_id: agent.client_id,
                    external_id: payload.call_id,
                    provider: 'bland',
                    status,
                    direction,
                    duration_seconds: durationSeconds,
                    cost_cents: costCents,
                    from_number: payload.from,
                    to_number: payload.to,
                    transcript,
                    audio_url: payload.recording_url,
                    summary: payload.summary,
                    sentiment: isVoicemail ? 'neutral' : null,
                    call_score: callScore,
                    started_at: startedAt,
                    ended_at: endedAt,
                    metadata: {
                        ...(payload.variables || {}),
                        ...(payload.metadata || {}),
                        answered_by: payload.answered_by,
                    },
                    experiment_id: experimentId,
                    variant_id: variantId,
                    lead_timezone: leadTimezone,
                },
                { onConflict: 'external_id' }
            );

        if (error) {
            console.error('Error saving Bland call:', error);
            return NextResponse.json({ received: true, warning: 'Failed to save call data' });
        }

        // AI-powered call analysis (runs in background)
        // Skip voicemail calls — no meaningful conversation to analyze, saves AI credits
        if (status === 'completed' && transcript && !isVoicemail) {
            waitUntil((async () => {
                try {
                    let aiEnabled = false;
                    if (agent.client_id) {
                        const { data: clientRow } = await supabase
                            .from('clients')
                            .select('ai_call_analysis')
                            .eq('id', agent.client_id)
                            .single();
                        aiEnabled = !!clientRow?.ai_call_analysis;
                    }

                    if (!shouldAnalyzeCall(aiEnabled, durationSeconds, transcript.length)) {
                        return;
                    }

                    const analysis = await analyzeCallTranscript(transcript, agent.name);
                    if (analysis) {
                        const { error: updateError } = await supabase
                            .from('calls')
                            .update({
                                sentiment: analysis.sentiment,
                                summary: analysis.summary,
                                call_score: analysis.lead_score,
                                topics: analysis.topics,
                                objections: analysis.objections,
                                metadata: {
                                    ...(payload.variables || {}),
                                    ...(payload.metadata || {}),
                                    answered_by: payload.answered_by,
                                    ai_analysis: {
                                        sentiment_score: analysis.sentiment_score,
                                        action_items: analysis.action_items,
                                        call_outcome: analysis.call_outcome,
                                        lead_score: analysis.lead_score,
                                        analyzed_at: new Date().toISOString(),
                                    },
                                },
                            })
                            .eq('external_id', payload.call_id);

                        if (updateError) {
                            console.error('Failed to update Bland call with AI analysis:', updateError);
                        }

                        await supabase.rpc('increment_ai_analysis_count', { agency_id_input: agent.agency_id });
                    }
                } catch (err) {
                    console.error('AI call analysis error (Bland):', err);
                }
            })());
        }

        // Broadcast real-time update.
        // NOTE: Bland only fires a single webhook event (on call completion), so unlike
        // Retell (call_started event) and Vapi (status-update → in-progress), we CANNOT
        // broadcast a 'call:started' event. The dashboard's active calls panel relies on
        // the real-time Bland API query (GET /api/calls/active → listBlandActiveCalls)
        // to show in-progress Bland calls instead.
        const isCallEnded = status === 'completed' || status === 'failed';
        waitUntil(broadcastCallUpdate({
            agencyId: agent.agency_id,
            event: isCallEnded ? 'call:ended' : 'call:updated',
            call: {
                call_id: payload.call_id,
                external_id: payload.call_id,
                agent_id: agent.id,
                agent_name: agent.name,
                status: status as 'queued' | 'in_progress' | 'completed' | 'failed',
                direction,
                from_number: payload.from,
                to_number: payload.to,
                started_at: startedAt,
                ended_at: endedAt || undefined,
                duration_seconds: durationSeconds,
                transcript,
                cost_cents: costCents,
                summary: payload.summary,
                sentiment: undefined,
            },
        }).catch(err => console.error('Failed to broadcast Bland call update:', err)));

        // Forward to agent's webhook if configured
        if (agent.webhook_url && isCallEnded) {
            const webhookPayload = {
                event: 'call_ended',
                call_id: payload.call_id,
                agent_id: agent.id,
                status,
                direction,
                duration_seconds: durationSeconds,
                cost_cents: costCents,
                from_number: payload.from,
                to_number: payload.to,
                transcript,
                recording_url: payload.recording_url,
                summary: payload.summary,
                started_at: startedAt,
                ended_at: endedAt,
                metadata: payload.metadata,
            };

            waitUntil(forwardToWebhook(agent.webhook_url, webhookPayload));
        }

        // Accumulate usage for per-minute billing
        if (isCallEnded && status === 'completed' && agent.client_id && durationSeconds > 0) {
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
                    console.error('Failed to accumulate usage for Bland call:', err);
                }
            })());
        }

        // Execute workflows if call ended
        if (isCallEnded) {
            const { data: agency } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', agent.agency_id)
                .single();

            if (agency) {
                const { data: workflows } = await supabase
                    .from('workflows')
                    .select('*')
                    .eq('agency_id', agent.agency_id)
                    .in('trigger', direction === 'inbound' ? ['call_ended', 'inbound_call_ended'] : ['call_ended'])
                    .eq('is_active', true)
                    .or(`agent_id.is.null,agent_id.eq.${agent.id}`);

                if (workflows && workflows.length > 0) {
                    const callData = {
                        call_id: payload.call_id,
                        agent_id: agent.id,
                        agent_name: agent.name,
                        status,
                        direction,
                        duration_seconds: durationSeconds,
                        cost_cents: costCents,
                        from_number: payload.from,
                        to_number: payload.to,
                        transcript,
                        recording_url: payload.recording_url,
                        summary: payload.summary,
                        started_at: startedAt,
                        ended_at: endedAt || undefined,
                        metadata: payload.metadata as Record<string, unknown> | undefined,
                    };

                    // Resolve GHL config
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

                    // Resolve HubSpot config
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

                    // Resolve Google Calendar config
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

                    // Inject Slack webhook URL
                    if (agency?.integrations?.slack?.enabled && agency.integrations.slack.webhook_url) {
                        callData.metadata = { ...(callData.metadata || {}), slack_webhook_url: agency.integrations.slack.webhook_url };
                    }

                    // Resolve Calendly config
                    const calendlyConfig = agency?.integrations?.calendly?.enabled && agency.integrations.calendly.api_token
                        ? { apiToken: agency.integrations.calendly.api_token, userUri: agency.integrations.calendly.user_uri || '', defaultEventTypeUri: agency.integrations.calendly.default_event_type_uri }
                        : undefined;

                    waitUntil(
                        executeWorkflows(workflows as Workflow[], callData, ghlConfig, hubspotConfig, gcalConfig, calendlyConfig, {
                            supabase,
                            agencyId: agent.agency_id,
                        })
                    );
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Bland webhook error:', error);
        // Return 200 to prevent webhook retry storms
        return NextResponse.json({ received: true, warning: 'Internal error occurred' });
    }
}
