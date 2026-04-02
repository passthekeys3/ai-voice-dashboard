import type { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VoiceProvider } from '@/types';

export type AgentRecord = {
    id: string;
    name: string;
    client_id: string | null;
    agency_id: string;
    webhook_url: string | null;
};

export interface NormalizedWebhookEvent {
    externalCallId: string;
    externalAgentId: string;
    provider: VoiceProvider;
    eventType: 'call_started' | 'call_ended' | 'ignored';
    dedupKey: string;
    skipDedup?: boolean;
    status?: string;
    direction?: 'inbound' | 'outbound';
    durationSeconds?: number;
    costCents?: number;
    fromNumber?: string;
    toNumber?: string;
    startedAt?: string;
    endedAt?: string;
    transcript?: string;
    recordingUrl?: string;
    summary?: string;
    sentiment?: string;
    callScore?: number | null;
    metadata?: Record<string, unknown>;
    experimentId?: string | null;
    variantId?: string | null;
    leadTimezone?: string | null;
    isVoicemail?: boolean;
    customHandler?: (supabase: SupabaseClient, agent: AgentRecord) => Promise<NextResponse>;
}

export interface WebhookAdapterOutput {
    event: NormalizedWebhookEvent;
    earlyReturn?: NextResponse;
    verifySignature: (apiKey: string) => boolean;
}
