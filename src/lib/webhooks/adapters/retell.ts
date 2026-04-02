/**
 * Retell Webhook Adapter
 *
 * Parses raw Retell webhook payloads into NormalizedWebhookEvent.
 * Handles 8 event types: call_started, call_ended, call_analyzed,
 * transcript_updated, and 4 transfer events.
 */

import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { waitUntil } from '@vercel/functions';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';
import {
    computeSentiment,
    computeCallScore,
    computeLeadTimezone,
    truncateTranscript,
    extractExperiment,
} from '../normalize';
import type { NormalizedWebhookEvent, WebhookAdapterOutput, AgentRecord } from './types';

// ── Payload Types ────────────────────────────────────────

type RetellEventType =
    | 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated'
    | 'transfer_started' | 'transfer_bridged' | 'transfer_cancelled' | 'transfer_ended';

interface RetellWebhookPayload {
    event: RetellEventType;
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
        transfer_to?: string;
        transfer_reason?: string;
    };
    transcript_with_tool_calls?: Array<{ role: string; content?: string; words?: unknown[] }>;
}

const ALLOWED_EVENTS: readonly RetellEventType[] = [
    'call_started', 'call_ended', 'call_analyzed', 'transcript_updated',
    'transfer_started', 'transfer_bridged', 'transfer_cancelled', 'transfer_ended',
] as const;

// ── Status Mapping ──────────────────────────────────────

function mapRetellStatus(callStatus: string): string {
    if (callStatus === 'ended') return 'completed';
    if (callStatus === 'error') return 'failed';
    if (callStatus === 'ongoing') return 'in_progress';
    return 'queued';
}

// ── Adapter ─────────────────────────────────────────────

export function parseRetellWebhook(rawBody: string, headers: Headers): WebhookAdapterOutput {
    let payload: RetellWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        console.error('[RETELL ADAPTER] Invalid JSON payload:', rawBody.slice(0, 500));
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature: () => false,
        };
    }

    const signatureHeader = headers.get('x-retell-signature') || '';
    const verifySignature = (apiKey: string) => Retell.verify(rawBody, apiKey, signatureHeader);

    if (!ALLOWED_EVENTS.includes(payload.event as typeof ALLOWED_EVENTS[number])) {
        console.warn(`[RETELL ADAPTER] Unknown event type: ${String(payload.event)}`);
        return {
            event: {} as NormalizedWebhookEvent,
            earlyReturn: NextResponse.json({ received: true }),
            verifySignature,
        };
    }

    const call = payload.call;
    const dedupKey = `retell:${call.call_id}:${payload.event}`;

    // ── Transcript Updated ───────────────────────────────
    if (payload.event === 'transcript_updated') {
        return {
            event: {
                externalCallId: call.call_id,
                externalAgentId: call.agent_id,
                provider: 'retell',
                eventType: 'ignored',
                dedupKey,
                customHandler: async (supabase, agent) => {
                    return handleTranscriptUpdated(supabase, payload, agent);
                },
            },
            verifySignature,
        };
    }

    // ── Call Analyzed ────────────────────────────────────
    if (payload.event === 'call_analyzed') {
        return {
            event: {
                externalCallId: call.call_id,
                externalAgentId: call.agent_id,
                provider: 'retell',
                eventType: 'ignored',
                dedupKey,
                customHandler: async (supabase) => {
                    return handleCallAnalyzed(supabase, payload);
                },
            },
            verifySignature,
        };
    }

    // ── Transfer Events ─────────────────────────────────
    if (payload.event.startsWith('transfer_')) {
        return {
            event: {
                externalCallId: call.call_id,
                externalAgentId: call.agent_id,
                provider: 'retell',
                eventType: 'ignored',
                dedupKey,
                customHandler: async (supabase) => {
                    return handleTransferEvent(supabase, payload);
                },
            },
            verifySignature,
        };
    }

    // ── Call Started / Ended ─────────────────────────────
    const direction = (call.direction || 'outbound') as 'inbound' | 'outbound';
    const durationSeconds = call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : 0;

    const status = mapRetellStatus(call.call_status);
    const costCents = Math.round(call.call_cost?.combined_cost || 0);
    const transcript = truncateTranscript(call.transcript);
    const nativeSentiment = call.call_analysis?.user_sentiment;
    const sentiment = computeSentiment(nativeSentiment, transcript, status);
    const callScore = computeCallScore(sentiment, durationSeconds, status);
    const leadTimezone = computeLeadTimezone(direction, call.from_number, call.to_number);
    const { experimentId, variantId } = extractExperiment(call.metadata);

    const event: NormalizedWebhookEvent = {
        externalCallId: call.call_id,
        externalAgentId: call.agent_id,
        provider: 'retell',
        eventType: payload.event === 'call_started' ? 'call_started' : 'call_ended',
        dedupKey,
        status,
        direction,
        durationSeconds,
        costCents,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        startedAt: new Date(call.start_timestamp).toISOString(),
        endedAt: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : undefined,
        transcript,
        recordingUrl: call.recording_url,
        summary: call.call_analysis?.call_summary,
        sentiment,
        callScore,
        metadata: {
            ...(call.metadata || {}),
            ...(call.call_cost?.product_costs ? { cost_breakdown: call.call_cost.product_costs } : {}),
        },
        experimentId,
        variantId,
        leadTimezone,
    };

    return { event, verifySignature };
}

// ── Custom Handlers ─────────────────────────────────────

async function handleTranscriptUpdated(
    supabase: ReturnType<typeof createServiceClient>,
    payload: RetellWebhookPayload,
    agent: AgentRecord,
): Promise<NextResponse> {
    let transcript: string | undefined;

    // Primary: transcript_with_tool_calls at ROOT level
    if (Array.isArray(payload.transcript_with_tool_calls) && payload.transcript_with_tool_calls.length > 0) {
        transcript = payload.transcript_with_tool_calls
            .filter(item => (item.role === 'agent' || item.role === 'user') && item.content)
            .map(item => `${item.role === 'agent' ? 'Agent' : 'User'}: ${item.content}`)
            .join('\n');
    }

    // Fallback: transcript string or transcript_object in call
    if (!transcript) transcript = payload.call.transcript;
    if (!transcript && Array.isArray(payload.call.transcript_object)) {
        transcript = payload.call.transcript_object
            .map(item => `${item.role === 'agent' ? 'Agent' : 'User'}: ${item.content}`)
            .join('\n');
    }

    if (transcript && transcript.length > MAX_TRANSCRIPT_LENGTH) {
        transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
    }

    if (!transcript) {
        return NextResponse.json({ received: true });
    }

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

    waitUntil(
        broadcastTranscriptUpdate({
            callId: payload.call.call_id,
            transcript,
        }).catch(err => console.error('Failed to broadcast transcript update:', err instanceof Error ? err.message : 'Unknown error'))
    );

    return NextResponse.json({ received: true });
}

async function handleCallAnalyzed(
    supabase: ReturnType<typeof createServiceClient>,
    payload: RetellWebhookPayload,
): Promise<NextResponse> {
    const updateFields: Record<string, unknown> = {};
    if (payload.call.call_analysis?.call_summary) updateFields.summary = payload.call.call_analysis.call_summary;
    if (payload.call.call_analysis?.user_sentiment) updateFields.sentiment = payload.call.call_analysis.user_sentiment;
    if (payload.call.transcript) updateFields.transcript = payload.call.transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
    if (payload.call.recording_url) updateFields.audio_url = payload.call.recording_url;

    if (Object.keys(updateFields).length > 0) {
        const { error } = await supabase
            .from('calls')
            .update(updateFields)
            .eq('external_id', payload.call.call_id);

        if (error) console.error('Error updating call_analyzed:', error.code);
    }

    return NextResponse.json({ received: true });
}

async function handleTransferEvent(
    supabase: ReturnType<typeof createServiceClient>,
    payload: RetellWebhookPayload,
): Promise<NextResponse> {
    const transferEvent = payload.event;
    const callId = payload.call.call_id;

    console.info(`[RETELL ADAPTER] Transfer event: ${transferEvent}, call=${callId}, to=${payload.call.transfer_to || 'unknown'}`);

    const { data: existingCall } = await supabase
        .from('calls')
        .select('metadata')
        .eq('external_id', callId)
        .single();

    const currentMetadata = (existingCall?.metadata as Record<string, unknown>) || {};
    const transfers = (currentMetadata.transfers as Array<Record<string, unknown>>) || [];

    if (transferEvent === 'transfer_started') {
        transfers.push({
            status: 'started',
            transfer_to: payload.call.transfer_to || null,
            reason: payload.call.transfer_reason || null,
            started_at: new Date().toISOString(),
        });
    } else {
        const latest = transfers[transfers.length - 1];
        if (latest) {
            if (transferEvent === 'transfer_bridged') {
                latest.status = 'bridged';
                latest.bridged_at = new Date().toISOString();
            } else if (transferEvent === 'transfer_cancelled') {
                latest.status = 'cancelled';
                latest.cancelled_at = new Date().toISOString();
            } else if (transferEvent === 'transfer_ended') {
                latest.status = 'ended';
                latest.ended_at = new Date().toISOString();
            }
        }
    }

    const { error } = await supabase
        .from('calls')
        .update({
            metadata: { ...currentMetadata, transfers, last_transfer_status: transferEvent.replace('transfer_', '') },
        })
        .eq('external_id', callId);

    if (error) console.error('Error updating transfer event:', error.code);

    return NextResponse.json({ received: true });
}
