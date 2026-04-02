/**
 * ElevenLabs Webhook Adapter
 *
 * Parses raw ElevenLabs Conversational AI webhook payloads into NormalizedWebhookEvent.
 * Only processes conversation.ended events. No signature verification
 * (ElevenLabs does not sign webhook payloads).
 */

import { NextResponse } from 'next/server';
import { flattenElevenLabsTranscript } from '@/lib/providers/elevenlabs';
import { inferBasicSentiment } from '@/lib/scoring/call-score';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';
import {
    computeCallScore,
    computeLeadTimezone,
    clampCostCents,
} from '../normalize';
import type { NormalizedWebhookEvent, WebhookAdapterOutput } from './types';

// ── Payload Types ────────────────────────────────────────

interface ElevenLabsWebhookPayload {
    type: 'conversation.ended' | 'conversation.started';
    data: {
        conversation_id: string;
        agent_id: string;
        status?: string;
        start_time_unix_secs?: number;
        end_time_unix_secs?: number;
        duration_secs?: number;
        cost?: number;
        transcript?: Array<{
            role: 'agent' | 'user';
            message: string;
            time_in_call_secs?: number;
        }>;
        analysis?: {
            call_successful?: string;
            evaluation_criteria_results?: Record<string, unknown>;
            data_collection_results?: Record<string, unknown>;
        };
        metadata?: Record<string, unknown>;
        call_type?: 'phone' | 'web';
        from_number?: string;
        to_number?: string;
        recording_url?: string;
    };
}

// ── Sentiment Derivation ────────────────────────────────

function deriveElevenLabsSentiment(
    data: ElevenLabsWebhookPayload['data'],
    transcriptText?: string,
): string | undefined {
    const callSuccess = data.analysis?.call_successful?.toLowerCase();
    if (callSuccess === 'true' || callSuccess === 'success') return 'positive';
    if (callSuccess === 'false' || callSuccess === 'failure') return 'negative';
    return (transcriptText ? inferBasicSentiment(transcriptText) : 'neutral') || 'neutral';
}

// ── Adapter ─────────────────────────────────────────────

export function parseElevenLabsWebhook(rawBody: string, _headers: Headers): WebhookAdapterOutput {
    let payload: ElevenLabsWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        console.error('[ELEVENLABS ADAPTER] Invalid JSON payload:', rawBody.slice(0, 500));
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature: () => false,
        };
    }

    // No signature verification for ElevenLabs
    const verifySignature = () => true;

    // Only process conversation.ended events
    if (payload.type !== 'conversation.ended') {
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    const data = payload.data;
    if (!data?.conversation_id || !data?.agent_id) {
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    // Note: direction bug preserved — both phone and web map to inbound
    const direction: 'inbound' | 'outbound' = data.call_type === 'phone' ? 'inbound' : 'inbound';
    const durationSeconds = data.duration_secs || 0;
    const costCents = clampCostCents(data.cost);

    const transcriptText = flattenElevenLabsTranscript(data.transcript)?.slice(0, MAX_TRANSCRIPT_LENGTH);
    const sentiment = deriveElevenLabsSentiment(data, transcriptText);
    const callScore = durationSeconds > 0 ? computeCallScore(sentiment, durationSeconds, 'completed') : null;

    const startedAt = data.start_time_unix_secs
        ? new Date(data.start_time_unix_secs * 1000).toISOString()
        : new Date().toISOString();
    const endedAt = data.end_time_unix_secs
        ? new Date(data.end_time_unix_secs * 1000).toISOString()
        : new Date().toISOString();

    const leadTimezone = computeLeadTimezone(direction, data.from_number, data.to_number);

    const dedupKey = `elevenlabs:${data.conversation_id}:ended`;

    const event: NormalizedWebhookEvent = {
        externalCallId: data.conversation_id,
        externalAgentId: data.agent_id,
        provider: 'elevenlabs',
        eventType: 'call_ended',
        dedupKey,
        status: 'completed',
        direction,
        durationSeconds,
        costCents,
        fromNumber: data.from_number,
        toNumber: data.to_number,
        startedAt,
        endedAt,
        transcript: transcriptText,
        recordingUrl: data.recording_url,
        summary: undefined,
        sentiment,
        callScore,
        metadata: {
            ...(data.metadata || {}),
            ...(data.analysis ? { elevenlabs_analysis: data.analysis } : {}),
        },
        leadTimezone,
    };

    return { event, verifySignature };
}
