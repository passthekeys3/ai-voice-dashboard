/**
 * Vapi Webhook Adapter
 *
 * Parses raw Vapi webhook payloads into NormalizedWebhookEvent.
 * Handles 3 event types: end-of-call-report, status-update (in-progress only),
 * and transcript (per-utterance live updates).
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { inferBasicSentiment } from '@/lib/scoring/call-score';
import { waitUntil } from '@vercel/functions';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';
import crypto from 'crypto';
import {
    computeCallScore,
    computeLeadTimezone,
    truncateTranscript,
    extractExperiment,
    clampCostCents,
} from '../normalize';
import type { NormalizedWebhookEvent, WebhookAdapterOutput, AgentRecord } from './types';

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

// ── HMAC Signature Verification ─────────────────────────

function verifyHmac(body: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    try {
        const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
    } catch {
        return false;
    }
}

// ── Status Mapping ──────────────────────────────────────

function mapVapiStatus(messageType: string, callStatus: string, endedReason?: string): string {
    if (messageType === 'status-update' && callStatus === 'in-progress') return 'in_progress';
    if (callStatus === 'in-progress') return 'in_progress';
    if (callStatus === 'queued' || callStatus === 'ringing') return 'queued';
    if (callStatus === 'failed' || endedReason === 'error') return 'failed';
    return 'completed';
}

// ── Sentiment Derivation ────────────────────────────────

function deriveVapiSentiment(
    call: NonNullable<VapiWebhookPayload['message']['call']>,
    status: string,
): string | undefined {
    if (status !== 'completed') return undefined;

    const successEval = call.analysis?.successEvaluation?.toLowerCase();
    if (successEval === 'success' || successEval === 'true') return 'positive';
    if (successEval === 'failure' || successEval === 'false') return 'negative';
    return (call.transcript ? inferBasicSentiment(call.transcript) : 'neutral') || 'neutral';
}

// ── Adapter ─────────────────────────────────────────────

export function parseVapiWebhook(rawBody: string, headers: Headers): WebhookAdapterOutput {
    let payload: VapiWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        console.error('[VAPI ADAPTER] Invalid JSON payload:', rawBody.slice(0, 500));
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature: () => false,
        };
    }

    const signatureHeader = headers.get('x-vapi-signature');
    const verifySignature = (apiKey: string) => verifyHmac(rawBody, signatureHeader, apiKey);

    const messageType = payload.message.type;

    // Only process events we care about
    if (messageType !== 'end-of-call-report' && messageType !== 'status-update' && messageType !== 'transcript') {
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    if (!payload.message.call) {
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    const call = payload.message.call;

    // For status-update, only process 'in-progress' (call started)
    if (messageType === 'status-update' && call.status !== 'in-progress') {
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    const dedupKey = `vapi:${call.id}:${messageType}`;

    // ── Transcript Event ─────────────────────────────────
    if (messageType === 'transcript') {
        return {
            event: {
                externalCallId: call.id,
                externalAgentId: call.assistantId,
                provider: 'vapi',
                eventType: 'ignored',
                dedupKey,
                skipDedup: true,
                customHandler: async (supabase, agent) => {
                    return handleTranscriptEvent(supabase, payload, call, agent);
                },
            },
            verifySignature,
        };
    }

    // ── Status Update / End of Call Report ────────────────
    const direction: 'inbound' | 'outbound' = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';
    const startedAt = call.startedAt || new Date().toISOString();
    const durationSeconds = startedAt && call.endedAt
        ? Math.round((new Date(call.endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : 0;

    const status = mapVapiStatus(messageType, call.status, payload.message.endedReason);
    const costCents = clampCostCents(call.cost);
    const sentiment = deriveVapiSentiment(call, status);
    const callScore = computeCallScore(sentiment, durationSeconds, status);
    const transcript = truncateTranscript(call.transcript);

    const fromNumber = direction === 'inbound' ? call.customer?.number : call.phoneNumber?.number;
    const toNumber = direction === 'inbound' ? call.phoneNumber?.number : call.customer?.number;
    const leadTimezone = computeLeadTimezone(direction, fromNumber, toNumber);
    const { experimentId, variantId } = extractExperiment(call.metadata);

    const eventType = messageType === 'status-update' && status === 'in_progress'
        ? 'call_started' as const
        : 'call_ended' as const;

    const event: NormalizedWebhookEvent = {
        externalCallId: call.id,
        externalAgentId: call.assistantId,
        provider: 'vapi',
        eventType,
        dedupKey,
        status,
        direction,
        durationSeconds,
        costCents,
        fromNumber,
        toNumber,
        startedAt,
        endedAt: call.endedAt,
        transcript,
        recordingUrl: call.recordingUrl,
        summary: call.analysis?.summary || call.summary,
        sentiment,
        callScore,
        metadata: {
            ...(call.metadata || {}),
            ...(call.monitor?.controlUrl ? { vapi_control_url: call.monitor.controlUrl } : {}),
            ...(call.monitor?.listenUrl ? { vapi_listen_url: call.monitor.listenUrl } : {}),
            ...(call.costBreakdown ? { cost_breakdown: call.costBreakdown } : {}),
            ...(call.analysis?.successEvaluation ? { vapi_success_evaluation: call.analysis.successEvaluation } : {}),
        },
        experimentId,
        variantId,
        leadTimezone,
    };

    return { event, verifySignature };
}

// ── Custom Handler: Transcript Event ────────────────────

async function handleTranscriptEvent(
    supabase: ReturnType<typeof createServiceClient>,
    payload: VapiWebhookPayload,
    call: NonNullable<VapiWebhookPayload['message']['call']>,
    agent: AgentRecord,
): Promise<NextResponse> {
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
