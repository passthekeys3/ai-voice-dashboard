import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { runPostProcessingPipeline, type ProcessedCall } from '@/lib/webhooks/post-process';
import { broadcastTranscriptUpdate } from '@/lib/realtime/broadcast';
import { waitUntil } from '@vercel/functions';
import type { WebhookAdapterOutput, AgentRecord } from './adapters/types';

export async function handleWebhookEvent(output: WebhookAdapterOutput): Promise<NextResponse> {
    const { event, earlyReturn, verifySignature } = output;

    // Step 1: Check for early return
    if (earlyReturn) {
        return earlyReturn;
    }

    try {
        // Step 2: Create supabase service client
        const supabase = await createServiceClient();

        // Step 3: Agent lookup
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, client_id, agency_id, webhook_url')
            .eq('external_id', event.externalAgentId)
            .eq('provider', event.provider)
            .single();

        // Step 4: No agent found
        if (agentError || !agent) {
            console.warn(
                `[webhook] No agent found for external_id=${event.externalAgentId} provider=${event.provider}`
            );
            return NextResponse.json({ received: true });
        }

        const typedAgent = agent as AgentRecord;

        // Step 5: Resolve provider API keys
        const resolvedKeys = await resolveProviderApiKeys(
            supabase,
            typedAgent.agency_id,
            typedAgent.client_id
        );

        // Step 6: Get provider key
        const apiKey = getProviderKey(resolvedKeys, event.provider);

        // Step 7: No key — unauthorized
        if (!apiKey) {
            console.warn(
                `[webhook] No API key found for provider=${event.provider} agency=${typedAgent.agency_id}`
            );
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Step 8: Verify signature
        if (!verifySignature(apiKey)) {
            console.warn(
                `[webhook] Signature verification failed for provider=${event.provider} call=${event.externalCallId}`
            );
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Step 9: Deduplication
        if (!event.skipDedup) {
            const { error: dedupError } = await supabase
                .from('webhook_events')
                .insert({ event_id: event.dedupKey });

            if (dedupError?.code === '23505') {
                return NextResponse.json({ received: true });
            }
        }

        // Step 10: Custom handler
        if (event.customHandler) {
            return await event.customHandler(supabase, typedAgent);
        }

        // Step 11: Ignored events
        if (event.eventType === 'ignored') {
            return NextResponse.json({ received: true });
        }

        // Step 12: Build upsert object and upsert into calls
        const callRecord: Record<string, unknown> = {
            external_id: event.externalCallId,
            agent_id: typedAgent.id,
            client_id: typedAgent.client_id,
            provider: event.provider,
            status: event.status,
            direction: event.direction,
            duration_seconds: event.durationSeconds,
            cost_cents: event.costCents,
            from_number: event.fromNumber,
            to_number: event.toNumber,
            started_at: event.startedAt,
            ended_at: event.endedAt,
            transcript: event.transcript,
            audio_url: event.recordingUrl,
            summary: event.summary,
            sentiment: event.sentiment,
            call_score: event.callScore,
            metadata: event.metadata,
            experiment_id: event.experimentId,
            variant_id: event.variantId,
            lead_timezone: event.leadTimezone,
        };

        // Remove undefined values to avoid overwriting existing data with null
        const cleanRecord = Object.fromEntries(
            Object.entries(callRecord).filter(([, v]) => v !== undefined)
        );

        await supabase
            .from('calls')
            .upsert(cleanRecord, { onConflict: 'external_id' });

        // Broadcast transcript for live transcript UI (Bland, ElevenLabs fire only on completion)
        if (event.transcript) {
            waitUntil(
                broadcastTranscriptUpdate({
                    callId: event.externalCallId,
                    transcript: event.transcript,
                }).catch(err => console.error('Failed to broadcast transcript:', err instanceof Error ? err.message : 'Unknown'))
            );
        }

        // Step 13: Build ProcessedCall and run post-processing pipeline
        const processedCall: ProcessedCall = {
            callId: event.externalCallId,
            agentId: typedAgent.id,
            agentName: typedAgent.name,
            agencyId: typedAgent.agency_id,
            clientId: typedAgent.client_id,
            provider: event.provider,
            isCallStarted: event.eventType === 'call_started',
            isCallEnded: event.status === 'completed' || event.status === 'failed',
            status: event.status || 'queued',
            direction: (event.direction || 'outbound') as 'inbound' | 'outbound',
            durationSeconds: event.durationSeconds || 0,
            costCents: event.costCents || 0,
            fromNumber: event.fromNumber,
            toNumber: event.toNumber,
            startedAt: event.startedAt || new Date().toISOString(),
            endedAt: event.endedAt,
            transcript: event.transcript,
            recordingUrl: event.recordingUrl,
            summary: event.summary,
            sentiment: event.sentiment,
            metadata: event.metadata,
            isVoicemail: event.isVoicemail,
            agentWebhookUrl: typedAgent.webhook_url || undefined,
            resolvedKeySource: resolvedKeys.source as Record<string, string>,
        };

        await runPostProcessingPipeline(supabase, processedCall);

        // Step 14: Return success
        return NextResponse.json({ received: true });
    } catch (error) {
        // Step 15: Catch-all error handler
        console.error('[webhook] Unhandled error in webhook handler:', error);
        return NextResponse.json({ received: true });
    }
}
