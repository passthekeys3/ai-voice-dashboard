/**
 * Bland AI Webhook Handler
 *
 * Bland fires a single webhook event per call (on completion).
 * Unlike Retell/Vapi, there is no call_started event — the dashboard's
 * active calls panel uses the Bland API directly for in-progress calls.
 *
 * Provider-specific logic (parsing, signature, voicemail detection) stays here.
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
import crypto from 'crypto';

// ── Signature Verification ───────────────────────────────

function verifyBlandSignature(body: string, signature: string | null, apiKey: string): boolean {
    if (!signature) return false;
    try {
        const hash = crypto.createHmac('sha256', apiKey).update(body).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
    } catch {
        return false;
    }
}

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

// ── Main Handler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        let payload: BlandWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.error('[BLAND WEBHOOK] Invalid JSON payload:', rawBody.slice(0, 500));
            return NextResponse.json({ received: true });
        }

        const supabase = createServiceClient();

        // ── Agent Lookup ─────────────────────────────────
        const pathwayId = payload.pathway_id || (payload.metadata?.pathway_id as string);
        if (!pathwayId) {
            console.warn(`Bland webhook received without pathway_id for call: ${payload.call_id}`);
            return NextResponse.json({ received: true });
        }

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

        // ── Auth ─────────────────────────────────────────
        const resolvedKeys = await resolveProviderApiKeys(supabase, agent.agency_id, agent.client_id);
        if (!resolvedKeys.bland_api_key) {
            console.error('Bland API key not configured');
            return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
        }

        const blandSignature = request.headers.get('x-bland-signature');
        if (!blandSignature || !verifyBlandSignature(rawBody, blandSignature, resolvedKeys.bland_api_key)) {
            console.error('Invalid Bland webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ── Dedup ────────────────────────────────────────
        const dedupKey = `bland:${payload.call_id}`;
        const { error: dedupError } = await supabase
            .from('webhook_events')
            .insert({ event_id: dedupKey });

        if (dedupError?.code === '23505') {
            return NextResponse.json({ received: true });
        }

        // ── Parse & Upsert ───────────────────────────────
        const durationSeconds = payload.call_length ? Math.round(payload.call_length * 60) : 0;
        const costCents = payload.price ? Math.round(payload.price * 100) : 0;
        const direction = (payload.metadata?.direction === 'inbound') ? 'inbound' : 'outbound';
        const isVoicemail = payload.answered_by === 'voicemail';
        const startedAt = payload.started_at || payload.created_at || new Date().toISOString();
        const endedAt = payload.end_at || null;

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

        const inferredSentiment = isVoicemail ? 'neutral' : inferBasicSentiment(transcript);
        const callScore = status === 'completed'
            ? (isVoicemail ? 0 : calculateCallScore({ sentiment: inferredSentiment, durationSeconds, status }))
            : null;

        const leadPhone = direction === 'inbound' ? payload.from : payload.to;
        const leadTimezone = leadPhone ? detectTimezone(leadPhone) : null;

        const experimentId = (payload.metadata?.experiment_id as string) || null;
        const variantId = (payload.metadata?.variant_id as string) || null;

        // Upsert call record
        const { error } = await supabase
            .from('calls')
            .upsert({
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
                sentiment: inferredSentiment || null,
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
            }, { onConflict: 'external_id' });

        if (error) {
            console.error('Error saving Bland call:', error.code);
            return NextResponse.json({ received: true });
        }

        // Broadcast transcript for live viewers
        if (transcript) {
            waitUntil(broadcastTranscriptUpdate({
                callId: payload.call_id,
                transcript,
            }));
        }

        // ── Post-Processing Pipeline ─────────────────────
        // Bland only fires on completion — isCallStarted is always false
        const isCallEnded = status === 'completed' || status === 'failed';

        const processedCall: ProcessedCall = {
            callId: payload.call_id,
            agentId: agent.id,
            agentName: agent.name,
            agencyId: agent.agency_id,
            clientId: agent.client_id,
            provider: 'bland',
            status,
            direction: direction as 'inbound' | 'outbound',
            durationSeconds,
            costCents,
            fromNumber: payload.from,
            toNumber: payload.to,
            startedAt,
            endedAt: endedAt || undefined,
            transcript,
            recordingUrl: payload.recording_url,
            summary: payload.summary,
            sentiment: inferredSentiment || undefined,
            metadata: { ...(payload.variables || {}), ...(payload.metadata || {}) },
            isCallStarted: false,
            isCallEnded,
            isVoicemail,
            agentWebhookUrl: agent.webhook_url,
            resolvedKeySource: resolvedKeys.source as Record<string, string>,
        };

        runPostProcessingPipeline(supabase, processedCall);

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Bland webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ received: true });
    }
}

// ── Helper: Map Bland status ─────────────────────────────

function mapBlandStatus(payload: BlandWebhookPayload): string {
    if (payload.completed || payload.status === 'completed' || payload.status === 'complete') return 'completed';
    if (payload.status === 'in-progress' || payload.status === 'ongoing') return 'in_progress';
    if (payload.status === 'error') return 'failed';
    return 'queued';
}
