import { calculateCallScore, inferBasicSentiment } from '@/lib/scoring/call-score';
import { detectTimezone } from '@/lib/timezone/detector';
import { MAX_TRANSCRIPT_LENGTH } from '@/lib/constants/config';

export function computeSentiment(nativeSentiment: string | undefined | null, transcript: string | undefined, status: string): string | undefined {
    if (nativeSentiment) return nativeSentiment;
    if (status === 'completed' && transcript) return inferBasicSentiment(transcript) || 'neutral';
    return undefined;
}

export function computeCallScore(sentiment: string | undefined, durationSeconds: number, status: string): number | null {
    if (status !== 'completed') return null;
    return calculateCallScore({ sentiment, durationSeconds, status });
}

export function computeLeadTimezone(direction: string, fromNumber?: string, toNumber?: string): string | null {
    const leadPhone = direction === 'inbound' ? fromNumber : toNumber;
    return leadPhone ? detectTimezone(leadPhone) : null;
}

export function truncateTranscript(transcript?: string): string | undefined {
    if (!transcript) return undefined;
    return transcript.length > MAX_TRANSCRIPT_LENGTH ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) : transcript;
}

export function extractExperiment(metadata?: Record<string, unknown>): { experimentId: string | null; variantId: string | null } {
    return {
        experimentId: (metadata?.experiment_id as string) || null,
        variantId: (metadata?.variant_id as string) || null,
    };
}

export function clampCostCents(cost: number | undefined | null, multiplier: number = 100): number {
    if (!cost) return 0;
    return Math.max(0, Math.min(Math.round(cost * multiplier), 1_000_000));
}
