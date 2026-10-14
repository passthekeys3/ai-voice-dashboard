/**
 * ElevenLabs Webhook Adapter
 *
 * Parses ElevenLabs post-call webhooks into NormalizedWebhookEvent:
 * - post_call_transcription: `data` is the full conversation (GET /v1/convai/conversations/{id})
 * - call_initiation_failure: an outbound dial that never connected
 * Other types (e.g. post_call_audio) are acknowledged and ignored.
 *
 * Requests are signed with the secret of the workspace webhook registered for
 * the agent's API key (see lib/providers/elevenlabs-webhook.ts).
 * Docs: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
 */

import { NextResponse } from 'next/server';
import {
    flattenElevenLabsTranscript,
    type ElevenLabsAnalysis,
    type ElevenLabsConversation,
} from '@/lib/providers/elevenlabs';
import { getElevenLabsWebhookSecret, verifyElevenLabsSignature } from '@/lib/providers/elevenlabs-webhook';
import { inferBasicSentiment } from '@/lib/scoring/call-score';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';
import {
    computeCallScore,
    computeLeadTimezone,
    clampCostCents,
} from '../normalize';
import type { NormalizedWebhookEvent, WebhookAdapterOutput } from './types';

// ── Payload Types ────────────────────────────────────────

type ElevenLabsWebhookPayload =
    | { type: 'post_call_transcription'; event_timestamp: number; data: ElevenLabsConversation }
    | {
        type: 'call_initiation_failure';
        event_timestamp: number;
        data: { agent_id: string; conversation_id: string; failure_reason?: string; metadata?: Record<string, unknown> };
    }
    | { type: string; event_timestamp?: number; data?: { agent_id?: string; conversation_id?: string } };

// ── Sentiment Derivation ────────────────────────────────

function deriveElevenLabsSentiment(
    analysis: ElevenLabsAnalysis | null | undefined,
    transcriptText?: string,
): string {
    if (analysis?.call_successful === 'success') return 'positive';
    if (analysis?.call_successful === 'failure') return 'negative';
    return (transcriptText ? inferBasicSentiment(transcriptText) : 'neutral') || 'neutral';
}

// ── Adapter ─────────────────────────────────────────────

const ignore = (verifySignature: WebhookAdapterOutput['verifySignature']): WebhookAdapterOutput => ({
    event: {} as NormalizedWebhookEvent,
    earlyReturn: NextResponse.json({ received: true }),
    verifySignature,
});

export function parseElevenLabsWebhook(rawBody: string, headers: Headers): WebhookAdapterOutput {
    let payload: ElevenLabsWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        console.error('[ELEVENLABS ADAPTER] Invalid JSON payload');
        return ignore(() => false);
    }

    // The handler resolves the agent's API key; its webhook secret signs the request
    const verifySignature = async (apiKey: string) => {
        const secret = await getElevenLabsWebhookSecret(apiKey);
        if (!secret) {
            console.warn('[ELEVENLABS ADAPTER] No webhook secret stored for this API key');
            return false;
        }
        return verifyElevenLabsSignature(rawBody, headers.get('elevenlabs-signature'), secret);
    };

    const conversationId = payload.data?.conversation_id;
    const agentId = payload.data?.agent_id;
    if (!conversationId || !agentId) return ignore(verifySignature);

    if (payload.type === 'call_initiation_failure') {
        const data = payload.data as Extract<ElevenLabsWebhookPayload, { type: 'call_initiation_failure' }>['data'];
        const now = new Date().toISOString();
        const event: NormalizedWebhookEvent = {
            externalCallId: conversationId,
            externalAgentId: agentId,
            provider: 'elevenlabs',
            eventType: 'call_ended',
            dedupKey: `elevenlabs:${conversationId}:initiation_failure`,
            status: 'failed',
            direction: 'outbound',
            durationSeconds: 0,
            costCents: 0,
            startedAt: now,
            endedAt: now,
            metadata: { failure_reason: data.failure_reason ?? 'unknown' },
        };
        return { event, verifySignature };
    }

    if (payload.type !== 'post_call_transcription') return ignore(verifySignature);

    const data = payload.data as ElevenLabsConversation;
    const meta = data.metadata ?? {};
    const phone = meta.phone_call ?? undefined;

    // Web/widget conversations have no phone_call and are user-initiated
    const direction: 'inbound' | 'outbound' = phone?.direction === 'outbound' ? 'outbound' : 'inbound';
    const fromNumber = direction === 'outbound' ? phone?.agent_number : phone?.external_number;
    const toNumber = direction === 'outbound' ? phone?.external_number : phone?.agent_number;

    const durationSeconds = meta.call_duration_secs || 0;
    const costCents = clampCostCents(meta.cost_fiat);
    const status = data.status === 'failed' ? 'failed' : 'completed';

    const transcriptText = flattenElevenLabsTranscript(data.transcript).slice(0, MAX_TRANSCRIPT_LENGTH) || undefined;
    const sentiment = deriveElevenLabsSentiment(data.analysis, transcriptText);
    const callScore = durationSeconds > 0 ? computeCallScore(sentiment, durationSeconds, status) : null;

    const startMs = meta.start_time_unix_secs ? meta.start_time_unix_secs * 1000 : Date.now();
    const startedAt = new Date(startMs).toISOString();
    const endedAt = new Date(startMs + durationSeconds * 1000).toISOString();

    const event: NormalizedWebhookEvent = {
        externalCallId: conversationId,
        externalAgentId: agentId,
        provider: 'elevenlabs',
        eventType: 'call_ended',
        dedupKey: `elevenlabs:${conversationId}:ended`,
        status,
        direction,
        durationSeconds,
        costCents,
        fromNumber,
        toNumber,
        startedAt,
        endedAt,
        transcript: transcriptText,
        summary: data.analysis?.transcript_summary || undefined,
        sentiment,
        callScore,
        metadata: {
            // Caller-supplied dynamic variables; drop ElevenLabs' own system__* ones
            ...Object.fromEntries(
                Object.entries(data.conversation_initiation_client_data?.dynamic_variables ?? {})
                    .filter(([key]) => !key.startsWith('system__')),
            ),
            ...(meta.termination_reason ? { termination_reason: meta.termination_reason } : {}),
            ...(data.analysis ? { elevenlabs_analysis: data.analysis } : {}),
        },
        leadTimezone: computeLeadTimezone(direction, fromNumber, toNumber),
    };

    return { event, verifySignature };
}
