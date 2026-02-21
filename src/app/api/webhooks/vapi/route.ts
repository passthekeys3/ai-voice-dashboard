import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { broadcastCallUpdate, broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { executeWorkflows } from '@/lib/workflows/executor';
import { detectTimezone } from '@/lib/timezone/detector';
import { accumulateUsage } from '@/lib/billing/usage';
import { calculateCallScore, inferBasicSentiment } from '@/lib/scoring/call-score';
import { analyzeCallTranscript, shouldAnalyzeCall } from '@/lib/analysis/call-analyzer';
import { resolveProviderApiKeys } from '@/lib/providers/resolve-keys';
import { isValidWebhookUrl } from '@/lib/webhooks/validation';
import { waitUntil } from '@vercel/functions';
import type { Workflow } from '@/types';
import crypto from 'crypto';

// Max transcript length to store in DB (≈100k words — generous for any real call, prevents abuse)
const MAX_TRANSCRIPT_LENGTH = 500_000;

// Verify Vapi webhook signature using HMAC-SHA256
function verifyVapiSignature(body: string, signature: string | null, apiKey: string): boolean {
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
        console.error('Failed to forward Vapi webhook:', err);
    }
}

// Vapi webhook payload types
interface VapiWebhookPayload {
    message: {
        type: 'status-update' | 'end-of-call-report' | 'transcript' | 'hang' | 'function-call';
        call?: {
            id: string;
            assistantId: string;
            type: string;
            status: string;
            startedAt?: string;
            endedAt?: string;
            transcript?: string;
            recordingUrl?: string;
            summary?: string;
            cost?: number;
            costBreakdown?: {
                transport?: number;
                stt?: number;
                llm?: number;
                tts?: number;
                vapi?: number;
                total: number;
            };
            customer?: { number?: string };
            phoneNumber?: { number?: string };
            metadata?: Record<string, unknown>;
            monitor?: { controlUrl?: string; listenUrl?: string };
            analysis?: { summary?: string; successEvaluation?: string };
        };
        endedReason?: string;
        // Transcript event fields (at message level, not inside call)
        role?: 'user' | 'assistant';
        transcriptType?: 'partial' | 'final';
        transcript?: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('x-vapi-signature');

        const payload: VapiWebhookPayload = JSON.parse(rawBody);

        // Process end-of-call-report, status-update (for call_started), and transcript events
        const messageType = payload.message.type;
        if (messageType !== 'end-of-call-report' && messageType !== 'status-update' && messageType !== 'transcript') {
            return NextResponse.json({ received: true });
        }
        if (!payload.message.call) {
            return NextResponse.json({ received: true });
        }

        const call = payload.message.call;

        // For status-update, only process 'in-progress' (call started) — skip queued/ringing
        if (messageType === 'status-update' && call.status !== 'in-progress') {
            return NextResponse.json({ received: true });
        }

        // Use service client for webhook operations (bypasses RLS)
        const supabase = createServiceClient();

        // Find agent by external_id (include agency_id, name, webhook_url)
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, client_id, agency_id, webhook_url')
            .eq('external_id', call.assistantId)
            .eq('provider', 'vapi')
            .single();

        if (!agent) {
            console.warn(`Agent not found for Vapi call: ${call.assistantId}`);
            return NextResponse.json({ received: true });
        }

        // Resolve API key (client key → agency key fallback)
        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        const vapiApiKey = resolvedKeys.vapi_api_key;

        if (!vapiApiKey) {
            console.error('Vapi API key not configured - cannot verify webhook signature');
            return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
        }

        if (!verifyVapiSignature(rawBody, signature, vapiApiKey)) {
            console.error('Invalid Vapi webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ======================================
        // Handle transcript events — append to DB and broadcast for live UI
        // ======================================
        if (messageType === 'transcript') {
            // Only process final transcripts to avoid duplicates/stuttering from partials
            if (payload.message.transcriptType !== 'final') {
                return NextResponse.json({ received: true });
            }

            const role = payload.message.role;
            const text = payload.message.transcript;
            if (!role || !text) {
                return NextResponse.json({ received: true });
            }

            // Format to match existing "Agent: text\nUser: text" format
            const speaker = role === 'assistant' ? 'Agent' : 'User';
            const newLine = `${speaker}: ${text}`;

            // Read current transcript, append new line, write back
            const { data: existingCall } = await supabase
                .from('calls')
                .select('transcript')
                .eq('external_id', call.id)
                .single();

            const currentTranscript = existingCall?.transcript || '';
            let updatedTranscript = currentTranscript
                ? `${currentTranscript}\n${newLine}`
                : newLine;
            // Cap transcript length to prevent oversized payloads
            if (updatedTranscript.length > MAX_TRANSCRIPT_LENGTH) {
                updatedTranscript = updatedTranscript.slice(0, MAX_TRANSCRIPT_LENGTH);
            }

            const { error: updateError } = await supabase
                .from('calls')
                .update({ transcript: updatedTranscript })
                .eq('external_id', call.id);

            if (updateError) {
                // Call record may not exist yet (race with status-update) — upsert minimal record
                await supabase
                    .from('calls')
                    .upsert({
                        agent_id: agent.id,
                        client_id: agent.client_id,
                        external_id: call.id,
                        provider: 'vapi',
                        status: 'in_progress',
                        direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
                        transcript: newLine,
                        started_at: call.startedAt || new Date().toISOString(),
                    }, { onConflict: 'external_id' });
            }

            // Broadcast transcript update for real-time UI
            waitUntil(
                broadcastTranscriptUpdate({
                    _agencyId: agent.agency_id,
                    callId: call.id,
                    transcript: updatedTranscript,
                }).catch(err => console.error('Failed to broadcast Vapi transcript update:', err))
            );

            return NextResponse.json({ received: true });
        }

        const startedAt = call.startedAt || new Date().toISOString();
        const endedAt = call.endedAt;
        const durationSeconds = startedAt && endedAt
            ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
            : 0;

        let status: string = 'completed';
        if (messageType === 'status-update' && call.status === 'in-progress') {
            status = 'in_progress';
        } else if (call.status === 'in-progress') {
            status = 'in_progress';
        } else if (call.status === 'queued' || call.status === 'ringing') {
            status = 'queued';
        } else if (call.status === 'failed' || payload.message.endedReason === 'error') {
            status = 'failed';
        }

        const direction = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

        // Detect lead timezone from phone number
        const leadPhone = direction === 'inbound'
            ? call.customer?.number
            : call.phoneNumber?.number;
        const leadTimezone = leadPhone ? detectTimezone(leadPhone) : null;

        // Check for A/B experiment metadata
        let experimentId: string | null = null;
        let variantId: string | null = null;
        if (call.metadata?.experiment_id && call.metadata?.variant_id) {
            experimentId = call.metadata.experiment_id as string;
            variantId = call.metadata.variant_id as string;
        }

        // Derive sentiment from Vapi's native analysis if available, otherwise infer from transcript.
        // successEvaluation maps: "success" → positive, "failure" → negative, else → inferred
        let inferredSentiment: string | undefined;
        if (status === 'completed') {
            const successEval = call.analysis?.successEvaluation?.toLowerCase();
            if (successEval === 'success' || successEval === 'true') {
                inferredSentiment = 'positive';
            } else if (successEval === 'failure' || successEval === 'false') {
                inferredSentiment = 'negative';
            } else {
                inferredSentiment = (call.transcript ? inferBasicSentiment(call.transcript) : 'neutral') || 'neutral';
            }
        }

        // Calculate call quality score
        const callScore = status === 'completed' ? calculateCallScore({
            sentiment: inferredSentiment,
            durationSeconds,
            status,
        }) : null;

        // Cap transcript length
        const callTranscript = call.transcript?.slice(0, MAX_TRANSCRIPT_LENGTH);

        // Upsert call
        const { error } = await supabase
            .from('calls')
            .upsert(
                {
                    agent_id: agent.id,
                    client_id: agent.client_id,
                    external_id: call.id,
                    provider: 'vapi',
                    status,
                    direction,
                    duration_seconds: durationSeconds,
                    cost_cents: call.cost ? Math.round(call.cost * 100) : 0,
                    from_number: call.customer?.number,
                    to_number: call.phoneNumber?.number,
                    transcript: callTranscript,
                    audio_url: call.recordingUrl,
                    summary: call.analysis?.summary || call.summary,
                    sentiment: inferredSentiment,
                    call_score: callScore,
                    started_at: startedAt,
                    ended_at: endedAt,
                    metadata: {
                        ...(call.metadata || {}),
                        ...(call.monitor?.controlUrl ? { vapi_control_url: call.monitor.controlUrl } : {}),
                        ...(call.monitor?.listenUrl ? { vapi_listen_url: call.monitor.listenUrl } : {}),
                        ...(call.costBreakdown ? { cost_breakdown: call.costBreakdown } : {}),
                        ...(call.analysis?.successEvaluation ? { vapi_success_evaluation: call.analysis.successEvaluation } : {}),
                    },
                    experiment_id: experimentId,
                    variant_id: variantId,
                    lead_timezone: leadTimezone,
                },
                { onConflict: 'external_id' }
            );

        if (error) {
            console.error('Error saving Vapi call:', error);
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
                        const { error: updateError } = await supabase
                            .from('calls')
                            .update({
                                sentiment: analysis.sentiment,
                                summary: analysis.summary,
                                call_score: analysis.lead_score,
                                topics: analysis.topics,
                                objections: analysis.objections,
                                metadata: {
                                    ...(call.metadata || {}),
                                    ai_analysis: {
                                        sentiment_score: analysis.sentiment_score,
                                        action_items: analysis.action_items,
                                        call_outcome: analysis.call_outcome,
                                        lead_score: analysis.lead_score,
                                        analyzed_at: new Date().toISOString(),
                                    },
                                },
                            })
                            .eq('external_id', call.id);

                        if (updateError) {
                            console.error('Failed to update Vapi call with AI analysis:', updateError);
                        }

                        // Increment agency AI analysis counter for usage tracking
                        await supabase.rpc('increment_ai_analysis_count', { agency_id_input: agent.agency_id });
                    }
                } catch (err) {
                    console.error('AI call analysis error (Vapi):', err);
                }
            })());
        }

        // Broadcast real-time update to connected clients
        const costCents = call.cost ? Math.round(call.cost * 100) : 0;
        const isCallStarted = messageType === 'status-update' && status === 'in_progress';
        const isCallEnded = status === 'completed' || status === 'failed';
        waitUntil(broadcastCallUpdate({
            agencyId: agent.agency_id,
            event: isCallStarted ? 'call:started'
                 : isCallEnded ? 'call:ended'
                 : 'call:updated',
            call: {
                call_id: call.id,
                external_id: call.id,
                agent_id: agent.id,
                agent_name: agent.name,
                status: status as 'queued' | 'in_progress' | 'completed' | 'failed',
                direction: direction as 'inbound' | 'outbound',
                from_number: call.customer?.number,
                to_number: call.phoneNumber?.number,
                started_at: startedAt,
                ended_at: endedAt,
                duration_seconds: durationSeconds,
                transcript: callTranscript,
                cost_cents: costCents,
                summary: call.analysis?.summary || call.summary,
                sentiment: inferredSentiment,
            },
        }).catch(err => console.error('Failed to broadcast Vapi call update:', err)));

        // Forward to agent's webhook if configured and call ended
        if (agent.webhook_url && isCallEnded) {
            const webhookPayload = {
                event: 'call_ended',
                call_id: call.id,
                agent_id: agent.id,
                status,
                direction,
                duration_seconds: durationSeconds,
                cost_cents: costCents,
                from_number: call.customer?.number,
                to_number: call.phoneNumber?.number,
                transcript: callTranscript,
                recording_url: call.recordingUrl,
                summary: call.analysis?.summary || call.summary,
                started_at: startedAt,
                ended_at: endedAt,
                metadata: call.metadata,
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
                    console.error('Failed to accumulate usage for Vapi call:', err);
                }
            })());
        }

        // ======================================
        // Inbound Receptionist: call_started (status-update with in-progress)
        // ======================================
        if (isCallStarted && direction === 'inbound') {
            waitUntil((async () => {
                try {
                    const { data: agency } = await supabase
                        .from('agencies')
                        .select('integrations')
                        .eq('id', agent.agency_id)
                        .single();

                    if (!agency) {
                        console.error('Agency not found for Vapi inbound processing:', agent.agency_id);
                        return;
                    }

                    const ghlInteg = agency.integrations?.ghl;
                    const ghlEnabled = ghlInteg?.enabled && (ghlInteg.api_key || ghlInteg.access_token);
                    const hubspotEnabled = agency.integrations?.hubspot?.enabled && agency.integrations.hubspot.access_token;

                    // Resolve GHL config
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

                    // Resolve HubSpot config
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

                    // Auto-create/lookup CRM contacts for inbound callers
                    if (resolvedGhlConfig && call.customer?.number) {
                        const { upsertContact } = await import('@/lib/integrations/ghl');
                        await upsertContact(resolvedGhlConfig, call.customer.number, {
                            source: 'BuildVoiceAI Inbound Call',
                            tags: ['inbound-call', 'ai-receptionist'],
                        });
                    }

                    if (resolvedHubspotConfig && call.customer?.number) {
                        const { upsertContact: hsUpsertContact } = await import('@/lib/integrations/hubspot');
                        await hsUpsertContact(resolvedHubspotConfig, call.customer.number, {
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
                            call_id: call.id,
                            agent_id: agent.id,
                            agent_name: agent.name,
                            status,
                            direction,
                            duration_seconds: 0,
                            cost_cents: 0,
                            from_number: call.customer?.number,
                            to_number: call.phoneNumber?.number,
                            started_at: startedAt,
                            metadata: call.metadata as Record<string, unknown> | undefined,
                        };

                        // Resolve Google Calendar config
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

                        // Inject Slack webhook URL
                        if (agency.integrations?.slack?.enabled && agency.integrations.slack.webhook_url) {
                            callData.metadata = { ...(callData.metadata || {}), slack_webhook_url: agency.integrations.slack.webhook_url };
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
                                console.error(`Vapi inbound workflow "${result.workflow_name}" errors:`, result.errors);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Vapi inbound call_started processing error:', err);
                }
            })());
        }

        // ======================================
        // Execute workflows for all call_ended events
        // ======================================
        if (!isCallEnded) {
            return NextResponse.json({ received: true });
        }

        waitUntil((async () => {
            try {
                const { data: agency } = await supabase
                    .from('agencies')
                    .select('integrations')
                    .eq('id', agent.agency_id)
                    .single();

                if (!agency) {
                    console.error('Agency not found for Vapi workflow processing:', agent.agency_id);
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

                // Auto-create/lookup CRM contacts for inbound callers
                if (direction === 'inbound') {
                    if (resolvedGhlConfig && call.customer?.number) {
                        const { upsertContact } = await import('@/lib/integrations/ghl');
                        await upsertContact(resolvedGhlConfig, call.customer.number, {
                            source: 'BuildVoiceAI Inbound Call',
                            tags: ['inbound-call', 'ai-receptionist'],
                        });
                    }

                    if (resolvedHubspotConfig && call.customer?.number) {
                        const { upsertContact: hsUpsertContact } = await import('@/lib/integrations/hubspot');
                        await hsUpsertContact(resolvedHubspotConfig, call.customer.number, {
                            source: 'BuildVoiceAI Inbound Call',
                            tags: ['inbound-call', 'ai-receptionist'],
                        });
                    }
                }

                // Fetch matching workflows (both generic call_ended AND direction-specific)
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
                    const callDataForWorkflow = {
                        call_id: call.id,
                        agent_id: agent.id,
                        agent_name: agent.name,
                        status,
                        direction,
                        duration_seconds: durationSeconds,
                        cost_cents: costCents,
                        from_number: call.customer?.number,
                        to_number: call.phoneNumber?.number,
                        transcript: callTranscript,
                        recording_url: call.recordingUrl,
                        summary: call.analysis?.summary || call.summary,
                        sentiment: inferredSentiment,
                        started_at: startedAt,
                        ended_at: endedAt,
                        metadata: (call.metadata || {}) as Record<string, unknown>,
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
                    if (agency?.integrations?.slack?.enabled && agency.integrations.slack.webhook_url) {
                        callDataForWorkflow.metadata = { ...callDataForWorkflow.metadata, slack_webhook_url: agency.integrations.slack.webhook_url };
                    }

                    // Resolve Calendly config
                    const calendlyConfig = agency?.integrations?.calendly?.enabled && agency.integrations.calendly.api_token
                        ? { apiToken: agency.integrations.calendly.api_token, userUri: agency.integrations.calendly.user_uri || '', defaultEventTypeUri: agency.integrations.calendly.default_event_type_uri }
                        : undefined;

                    const results = await executeWorkflows(workflows as Workflow[], callDataForWorkflow, resolvedGhlConfig, resolvedHubspotConfig, gcalConfig, calendlyConfig, {
                        supabase,
                        agencyId: agent.agency_id,
                    });
                    for (const result of results) {
                        if (result.actions_failed > 0) {
                            console.error(`Vapi workflow "${result.workflow_name}" errors:`, result.errors);
                        }
                    }
                }
            } catch (err) {
                console.error('Vapi workflow processing error:', err);
            }
        })());

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Vapi webhook error:', error);
        // Return 200 to prevent webhook retry storms — log for internal investigation
        return NextResponse.json({ received: true, warning: 'Internal error occurred' });
    }
}
