/**
 * Vapi Webhook Handler
 *
 * Processes 3 event types from Vapi:
 *   - transcript: per-utterance live transcript updates → append to DB + broadcast
 *   - status-update (in-progress): call started → upsert + post-processing pipeline
 *   - end-of-call-report: call ended → upsert + post-processing pipeline
 *
 * Provider-specific logic (parsing, signature, transcript) stays here.
 * Post-upsert processing (AI analysis, billing, workflows, etc.) is handled
 * by the shared pipeline in lib/webhooks/post-process.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { detectTimezone } from '@/lib/timezone/detector';
import { calculateCallScore, inferBasicSentiment } from '@/lib/scoring/call-score';
import { resolveProviderApiKeys } from '@/lib/providers/resolve-keys';
import { waitUntil } from '@vercel/functions';
import { runPostProcessingPipeline, type ProcessedCall } from '@/lib/webhooks/post-process';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';
import crypto from 'crypto';

// ── Signature Verification ───────────────────────────────

function verifyVapiSignature(body: string, signature: string | null, apiKey: string): boolean {
    if (!signature) return false;
    try {
        const hash = crypto.createHmac('sha256', apiKey).update(body).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
    } catch {
        return false;
    }
}

// ── Payload Types ────────────────────────────────────────

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
        role?: 'user' | 'assistant';
        transcriptType?: 'partial' | 'final';
        transcript?: string;
    };
}

// ── Main Handler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-vapi-signature');

        let payload: VapiWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.error('[VAPI WEBHOOK] Invalid JSON payload:', rawBody.slice(0, 500));
            return NextResponse.json({ received: true });
        }

        // Only process events we care about
        const messageType = payload.message.type;
        if (messageType !== 'end-of-call-report' && messageType !== 'status-update' && messageType !== 'transcript') {
            return NextResponse.json({ received: true });
        }
        if (!payload.message.call) {
            return NextResponse.json({ received: true });
        }

        const call = payload.message.call;

        // For status-update, only process 'in-progress' (call started)
        if (messageType === 'status-update' && call.status !== 'in-progress') {
            return NextResponse.json({ received: true });
        }

        const supabase = createServiceClient();

        // ── Agent Lookup & Auth ──────────────────────────
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

        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        if (!resolvedKeys.vapi_api_key) {
            console.error('Vapi API key not configured');
            return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
        }

        if (!verifyVapiSignature(rawBody, signature, resolvedKeys.vapi_api_key)) {
            console.error('Invalid Vapi webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ── Dedup (skip for transcript events — they're high-frequency) ──
        if (messageType !== 'transcript') {
            const dedupKey = `vapi:${call.id}:${messageType}`;
            const { error: dedupError } = await supabase
                .from('webhook_events')
                .insert({ event_id: dedupKey });

            if (dedupError?.code === '23505') {
                return NextResponse.json({ received: true });
            }
        }

        // ── Transcript Event Handler ─────────────────────
        if (messageType === 'transcript') {
            return handleTranscriptEvent(supabase, payload, call, agent);
        }

        // ── Call Started / Ended: Parse & Upsert ─────────
        const direction = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';
        const startedAt = call.startedAt || new Date().toISOString();
        const durationSeconds = startedAt && call.endedAt
            ? Math.round((new Date(call.endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
            : 0;

        const status = mapVapiStatus(messageType, call.status, payload.message.endedReason);
        const costCents = call.cost ? Math.max(0, Math.min(Math.round(call.cost * 100), 1_000_000)) : 0;
        const sentiment = deriveSentiment(call, status);
        const callScore = status === 'completed' ? calculateCallScore({ sentiment, durationSeconds, status }) : null;
        const callTranscript = call.transcript?.slice(0, MAX_TRANSCRIPT_LENGTH);

        const leadPhone = direction === 'inbound' ? call.customer?.number : call.phoneNumber?.number;
        const leadTimezone = leadPhone ? detectTimezone(leadPhone) : null;

        // A/B experiment metadata
        const experimentId = (call.metadata?.experiment_id as string) || null;
        const variantId = (call.metadata?.variant_id as string) || null;

        // Upsert call record
        const { error } = await supabase
            .from('calls')
            .upsert({
                agent_id: agent.id,
                client_id: agent.client_id,
                external_id: call.id,
                provider: 'vapi',
                status,
                direction,
                duration_seconds: durationSeconds,
                cost_cents: costCents,
                from_number: direction === 'inbound' ? call.customer?.number : call.phoneNumber?.number,
                to_number: direction === 'inbound' ? call.phoneNumber?.number : call.customer?.number,
                transcript: callTranscript,
                audio_url: call.recordingUrl,
                summary: call.analysis?.summary || call.summary,
                sentiment,
                call_score: callScore,
                started_at: startedAt,
                ended_at: call.endedAt,
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
            }, { onConflict: 'external_id' });

        if (error) {
            console.error('Error saving Vapi call:', error.code);
            return NextResponse.json({ received: true });
        }

        // ── Post-Processing Pipeline ─────────────────────
        const isCallStarted = messageType === 'status-update' && status === 'in_progress';
        const isCallEnded = status === 'completed' || status === 'failed';

        const processedCall: ProcessedCall = {
            callId: call.id,
            agentId: agent.id,
            agentName: agent.name,
            agencyId: agent.agency_id,
            clientId: agent.client_id,
            provider: 'vapi',
            status,
            direction: direction as 'inbound' | 'outbound',
            durationSeconds,
            costCents,
            fromNumber: direction === 'inbound' ? call.customer?.number : call.phoneNumber?.number,
            toNumber: direction === 'inbound' ? call.phoneNumber?.number : call.customer?.number,
            startedAt,
            endedAt: call.endedAt,
            transcript: callTranscript,
            recordingUrl: call.recordingUrl,
            summary: call.analysis?.summary || call.summary,
            sentiment,
            metadata: call.metadata,
            isCallStarted,
            isCallEnded,
            agentWebhookUrl: agent.webhook_url,
            resolvedKeySource: resolvedKeys.source as Record<string, string>,
        };

        runPostProcessingPipeline(supabase, processedCall);

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Vapi webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ received: true });
    }
}

// ── Helper: Transcript Event ─────────────────────────────

async function handleTranscriptEvent(
    supabase: ReturnType<typeof createServiceClient>,
    payload: VapiWebhookPayload,
    call: NonNullable<VapiWebhookPayload['message']['call']>,
    agent: { id: string; agency_id: string; client_id: string | null },
) {
    // Only process final transcripts (skip partials to avoid duplicates)
    if (payload.message.transcriptType !== 'final') {
        return NextResponse.json({ received: true });
    }

    const role = payload.message.role;
    const text = payload.message.transcript;
    if (!role || !text) {
        return NextResponse.json({ received: true });
    }

    const speaker = role === 'assistant' ? 'Agent' : 'User';
    const newLine = `${speaker}: ${text}`;

    // Atomically append via Postgres function (avoids race conditions)
    const { data: updatedCall, error: updateError } = await supabase
        .rpc('append_transcript_line', {
            p_external_id: call.id,
            p_new_line: newLine,
            p_max_length: MAX_TRANSCRIPT_LENGTH,
        }) as { data: { transcript: string }[] | null; error: Error | null };

    // Fallback if RPC unavailable or call record doesn't exist yet
    if (updateError) {
        try {
            const { data: existingCall } = await supabase
                .from('calls')
                .select('transcript')
                .eq('external_id', call.id)
                .single();

            const merged = existingCall?.transcript
                ? `${existingCall.transcript}\n${newLine}`
                : newLine;

            await supabase
                .from('calls')
                .upsert({
                    agent_id: agent.id,
                    client_id: agent.client_id,
                    external_id: call.id,
                    provider: 'vapi',
                    status: 'in_progress',
                    direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
                    transcript: merged.slice(0, MAX_TRANSCRIPT_LENGTH),
                    started_at: call.startedAt || new Date().toISOString(),
                }, { onConflict: 'external_id' });
        } catch (fallbackErr) {
            console.error('Vapi transcript fallback failed:', fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error');
        }
    }

    // Broadcast for live transcript UI
    waitUntil(
        broadcastTranscriptUpdate({
            callId: call.id,
            transcript: updatedCall?.[0]?.transcript || newLine,
        }).catch(err => console.error('Failed to broadcast Vapi transcript:', err instanceof Error ? err.message : 'Unknown error'))
    );

    return NextResponse.json({ received: true });
}

// ── Helper: Map Vapi status to internal status ───────────

function mapVapiStatus(messageType: string, callStatus: string, endedReason?: string): string {
    if (messageType === 'status-update' && callStatus === 'in-progress') return 'in_progress';
    if (callStatus === 'in-progress') return 'in_progress';
    if (callStatus === 'queued' || callStatus === 'ringing') return 'queued';
    if (callStatus === 'failed' || endedReason === 'error') return 'failed';
    return 'completed';
}

// ── Helper: Derive sentiment from Vapi analysis ──────────

function deriveSentiment(
    call: NonNullable<VapiWebhookPayload['message']['call']>,
    status: string,
): string | undefined {
    if (status !== 'completed') return undefined;

    const successEval = call.analysis?.successEvaluation?.toLowerCase();
    if (successEval === 'success' || successEval === 'true') return 'positive';
    if (successEval === 'failure' || successEval === 'false') return 'negative';
    return (call.transcript ? inferBasicSentiment(call.transcript) : 'neutral') || 'neutral';
}
