/**
 * Bland AI Webhook Adapter
 *
 * Parses raw Bland webhook payloads into NormalizedWebhookEvent.
 * Bland fires a single webhook event per call (on completion).
 * Unlike Retell/Vapi, there is no call_started event.
 */

import { NextResponse } from 'next/server';
import { inferBasicSentiment, calculateCallScore } from '@/lib/scoring/call-score';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';
import crypto from 'crypto';
import {
    computeLeadTimezone,
    extractExperiment,
} from '../normalize';
import type { NormalizedWebhookEvent, WebhookAdapterOutput } from './types';

// ── Payload Types ────────────────────────────────────────

interface BlandWebhookPayload {
    call_id: string;
    c_id?: string;
    pathway_id?: string;
    to: string;
    from?: string;
    status: string;
    completed: boolean;
    call_length?: number;
    price?: number;
    answered_by?: string;
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

function mapBlandStatus(payload: BlandWebhookPayload): string {
    if (payload.completed || payload.status === 'completed' || payload.status === 'complete') return 'completed';
    if (payload.status === 'in-progress' || payload.status === 'ongoing') return 'in_progress';
    if (payload.status === 'error') return 'failed';
    return 'queued';
}

// ── Adapter ─────────────────────────────────────────────

export function parseBlandWebhook(rawBody: string, headers: Headers): WebhookAdapterOutput {
    let payload: BlandWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        console.error('[BLAND ADAPTER] Invalid JSON payload:', rawBody.slice(0, 500));
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature: () => false,
        };
    }

    const signatureHeader = headers.get('x-bland-signature');
    const verifySignature = (apiKey: string) => verifyHmac(rawBody, signatureHeader, apiKey);

    // Agent lookup requires pathway_id
    const pathwayId = payload.pathway_id || (payload.metadata?.pathway_id as string);
    if (!pathwayId) {
        console.warn(`[BLAND ADAPTER] Webhook received without pathway_id for call: ${payload.call_id}`);
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    // ── Normalize Fields ─────────────────────────────────
    const durationSeconds = payload.call_length ? Math.round(payload.call_length * 60) : 0;
    const costCents = payload.price ? Math.round(payload.price * 100) : 0;
    const direction: 'inbound' | 'outbound' = payload.metadata?.direction === 'inbound' ? 'inbound' : 'outbound';
    const isVoicemail = payload.answered_by === 'voicemail';
    const startedAt = payload.started_at || payload.created_at || new Date().toISOString();
    const endedAt = payload.end_at || undefined;

    const status = mapBlandStatus(payload);

    // Build transcript from structured array or flat string
    let transcript: string | undefined;
    if (payload.transcripts && payload.transcripts.length > 0) {
        transcript = payload.transcripts
            .map(t => `${t.user === 'assistant' ? 'Agent' : 'User'}: ${t.text}`)
            .join('\n');
    } else {
        transcript = payload.concatenated_transcript || undefined;
    }
    if (transcript && transcript.length > MAX_TRANSCRIPT_LENGTH) {
        transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
    }

    const inferredSentiment = isVoicemail ? 'neutral' : (inferBasicSentiment(transcript) || undefined);
    const callScore = status === 'completed'
        ? (isVoicemail ? 0 : calculateCallScore({ sentiment: inferredSentiment, durationSeconds, status }))
        : null;

    const leadTimezone = computeLeadTimezone(direction, payload.from, payload.to);
    const { experimentId, variantId } = extractExperiment(payload.metadata);

    const dedupKey = `bland:${payload.call_id}`;

    const event: NormalizedWebhookEvent = {
        externalCallId: payload.call_id,
        externalAgentId: pathwayId,
        provider: 'bland',
        eventType: 'call_ended',
        dedupKey,
        status,
        direction,
        durationSeconds,
        costCents,
        fromNumber: payload.from,
        toNumber: payload.to,
        startedAt,
        endedAt,
        transcript,
        recordingUrl: payload.recording_url,
        summary: payload.summary,
        sentiment: inferredSentiment || undefined,
        callScore,
        metadata: {
            ...(payload.variables || {}),
            ...(payload.metadata || {}),
            answered_by: payload.answered_by,
        },
        experimentId,
        variantId,
        leadTimezone,
        isVoicemail,
    };

    return { event, verifySignature };
}
