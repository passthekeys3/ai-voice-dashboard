/**
 * Retell Webhook Handler
 *
 * Processes 8 event types from Retell:
 *   - call_started: call initiated → upsert + post-processing pipeline
 *   - call_ended: call completed → upsert + post-processing pipeline
 *   - call_analyzed: analysis ready → selective update (summary/sentiment only)
 *   - transcript_updated: live transcript → upsert + broadcast
 *   - transfer_started: call transfer initiated → update call metadata
 *   - transfer_bridged: transfer connected → update call metadata
 *   - transfer_cancelled: transfer failed/cancelled → update call metadata
 *   - transfer_ended: transfer completed → update call metadata
 *
 * Provider-specific logic (parsing, SDK signature, transcript format) stays here.
 * Post-upsert processing is handled by the shared pipeline in lib/webhooks/post-process.ts.
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
import Retell from 'retell-sdk';

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
        // Transfer-specific fields
        transfer_to?: string;
        transfer_reason?: string;
    };
    transcript_with_tool_calls?: Array<{ role: string; content?: string; words?: unknown[] }>;
}

const ALLOWED_EVENTS: readonly RetellEventType[] = [
    'call_started', 'call_ended', 'call_analyzed', 'transcript_updated',
    'transfer_started', 'transfer_bridged', 'transfer_cancelled', 'transfer_ended',
] as const;

// ── Main Handler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-retell-signature');

        let payload: RetellWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.error('[RETELL WEBHOOK] Invalid JSON payload:', rawBody.slice(0, 500));
            return NextResponse.json({ received: true });
        }

        if (!ALLOWED_EVENTS.includes(payload.event as typeof ALLOWED_EVENTS[number])) {
            console.warn(`[RETELL WEBHOOK] Unknown event type: ${String(payload.event)}`);
            return NextResponse.json({ received: true });
        }

        console.info(`[RETELL WEBHOOK] Received: event=${payload.event}, call=${payload.call.call_id}, agent=${payload.call.agent_id}`);

        const supabase = createServiceClient();

        // ── Agent Lookup & Auth ──────────────────────────
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

        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        if (!resolvedKeys.retell_api_key) {
            console.error('Retell API key not configured');
            return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
        }

        if (!Retell.verify(rawBody, resolvedKeys.retell_api_key, signature || '')) {
            console.error(`[RETELL WEBHOOK] SIGNATURE REJECTED: event=${payload.event}, call=${payload.call.call_id}`);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ── Dedup ────────────────────────────────────────
        const dedupKey = `retell:${payload.call.call_id}:${payload.event}`;
        const { error: dedupError } = await supabase
            .from('webhook_events')
            .insert({ event_id: dedupKey });

        if (dedupError?.code === '23505') {
            return NextResponse.json({ received: true });
        }

        // ── Transcript Updated ───────────────────────────
        if (payload.event === 'transcript_updated') {
            return handleTranscriptUpdated(supabase, payload, agent);
        }

        // ── Call Analyzed (selective update only) ─────────
        if (payload.event === 'call_analyzed') {
            return handleCallAnalyzed(supabase, payload);
        }

        // ── Transfer Events ──────────────────────────────
        if (payload.event.startsWith('transfer_')) {
            return handleTransferEvent(supabase, payload);
        }

        // ── Call Started / Ended: Parse & Upsert ─────────
        const direction = payload.call.direction || 'outbound';
        const durationSeconds = payload.call.end_timestamp && payload.call.start_timestamp
            ? Math.round((payload.call.end_timestamp - payload.call.start_timestamp) / 1000)
            : 0;

        const status = mapRetellStatus(payload.call.call_status);
        const costCents = Math.round(payload.call.call_cost?.combined_cost || 0);
        const callTranscript = payload.call.transcript?.slice(0, MAX_TRANSCRIPT_LENGTH);

        const nativeSentiment = payload.call.call_analysis?.user_sentiment;
        const sentiment = nativeSentiment
            || (status === 'completed' && callTranscript ? inferBasicSentiment(callTranscript) : null)
            || null;

        const callScore = status === 'completed' ? calculateCallScore({
            sentiment: sentiment || undefined,
            durationSeconds,
            status,
        }) : null;

        const leadPhone = direction === 'inbound' ? payload.call.from_number : payload.call.to_number;
        const leadTimezone = leadPhone ? detectTimezone(leadPhone) : null;

        const experimentId = (payload.call.metadata?.experiment_id as string) || null;
        const variantId = (payload.call.metadata?.variant_id as string) || null;

        // Upsert call record
        const { error } = await supabase
            .from('calls')
            .upsert({
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
                sentiment,
                call_score: callScore,
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
                lead_timezone: leadTimezone,
            }, { onConflict: 'external_id' });

        if (error) {
            console.error('Error saving Retell call:', error.code);
            return NextResponse.json({ received: true });
        }

        // ── Post-Processing Pipeline ─────────────────────
        const isCallStarted = payload.event === 'call_started';
        const isCallEnded = payload.event === 'call_ended';

        const processedCall: ProcessedCall = {
            callId: payload.call.call_id,
            agentId: agent.id,
            agentName: agent.name,
            agencyId: agent.agency_id,
            clientId: agent.client_id,
            provider: 'retell',
            status,
            direction: direction as 'inbound' | 'outbound',
            durationSeconds,
            costCents,
            fromNumber: payload.call.from_number,
            toNumber: payload.call.to_number,
            startedAt: new Date(payload.call.start_timestamp).toISOString(),
            endedAt: payload.call.end_timestamp
                ? new Date(payload.call.end_timestamp).toISOString()
                : undefined,
            transcript: callTranscript,
            recordingUrl: payload.call.recording_url,
            summary: payload.call.call_analysis?.call_summary,
            sentiment: sentiment || undefined,
            metadata: payload.call.metadata,
            isCallStarted,
            isCallEnded,
            agentWebhookUrl: agent.webhook_url,
            resolvedKeySource: resolvedKeys.source as Record<string, string>,
        };

        runPostProcessingPipeline(supabase, processedCall);

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Retell webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ received: true });
    }
}

// ── Helper: Transcript Updated ───────────────────────────

async function handleTranscriptUpdated(
    supabase: ReturnType<typeof createServiceClient>,
    payload: RetellWebhookPayload,
    agent: { id: string; agency_id: string; client_id: string | null },
) {
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

    // Upsert (not just update) — call record may not exist yet
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

    // Broadcast for live transcript UI
    waitUntil(
        broadcastTranscriptUpdate({
            callId: payload.call.call_id,
            transcript,
        }).catch(err => console.error('Failed to broadcast transcript update:', err instanceof Error ? err.message : 'Unknown error'))
    );

    return NextResponse.json({ received: true });
}

// ── Helper: Call Analyzed (selective update) ──────────────

async function handleCallAnalyzed(
    supabase: ReturnType<typeof createServiceClient>,
    payload: RetellWebhookPayload,
) {
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

// ── Helper: Transfer Events ─────────────────────────────

async function handleTransferEvent(
    supabase: ReturnType<typeof createServiceClient>,
    payload: RetellWebhookPayload,
) {
    const transferEvent = payload.event; // transfer_started | transfer_bridged | transfer_cancelled | transfer_ended
    const callId = payload.call.call_id;

    console.info(`[RETELL WEBHOOK] Transfer event: ${transferEvent}, call=${callId}, to=${payload.call.transfer_to || 'unknown'}`);

    // Update call metadata with transfer info
    const { data: existingCall } = await supabase
        .from('calls')
        .select('metadata')
        .eq('external_id', callId)
        .single();

    const currentMetadata = (existingCall?.metadata as Record<string, unknown>) || {};
    const transfers = (currentMetadata.transfers as Array<Record<string, unknown>>) || [];

    if (transferEvent === 'transfer_started') {
        // Add a new transfer entry
        transfers.push({
            status: 'started',
            transfer_to: payload.call.transfer_to || null,
            reason: payload.call.transfer_reason || null,
            started_at: new Date().toISOString(),
        });
    } else {
        // Update the latest transfer entry
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

// ── Helper: Map Retell status ────────────────────────────

function mapRetellStatus(callStatus: string): string {
    if (callStatus === 'ended') return 'completed';
    if (callStatus === 'error') return 'failed';
    if (callStatus === 'ongoing') return 'in_progress';
    return 'queued';
}
