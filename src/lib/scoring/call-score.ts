/**
 * Call Scoring Algorithm
 *
 * Computes a composite 0-100 quality score for each call based on:
 * - Completion status (base score)
 * - Sentiment (positive/neutral/negative)
 * - Duration appropriateness (sweet spot vs. too short/long)
 *
 * Deterministic — no AI/LLM required.
 */

interface CallScoreInput {
    sentiment?: string;        // 'positive', 'negative', 'neutral', or undefined
    durationSeconds: number;
    status: string;            // 'completed', 'failed', etc.
}

/**
 * Calculate a composite call quality score (0-100)
 */
export function calculateCallScore(input: CallScoreInput): number {
    const { sentiment, durationSeconds, status } = input;

    // Failed/incomplete calls get a flat low score
    if (status !== 'completed') {
        return 0;
    }

    let score = 50; // Base score for completed call

    // Sentiment factor (-15 to +20)
    if (sentiment) {
        const lower = sentiment.toLowerCase();
        if (lower === 'positive') score += 20;
        else if (lower === 'neutral') score += 5;
        else if (lower === 'negative') score -= 15;
    }

    // Duration appropriateness (-10 to +15)
    if (durationSeconds < 15) {
        // Very short — likely dropped or bad connection
        score -= 10;
    } else if (durationSeconds >= 60 && durationSeconds <= 600) {
        // Sweet spot: 1-10 minutes
        score += 15;
    } else if (durationSeconds > 900) {
        // Long call — engaged but maybe too long
        score += 5;
    } else if (durationSeconds >= 15 && durationSeconds < 60) {
        // Short but not ultra-short
        score += 0;
    } else {
        // 600-900s — decent
        score += 10;
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
}

/**
 * Basic keyword-based sentiment inference from transcript.
 * Used for providers (like Vapi) that don't provide native sentiment analysis.
 *
 * Returns undefined if transcript is empty/unavailable.
 */
export function inferBasicSentiment(transcript?: string): string | undefined {
    if (!transcript || transcript.trim().length < 20) return undefined;

    const lower = transcript.toLowerCase();

    const positiveSignals = [
        'thank you', 'thanks', 'great', 'perfect', 'excellent',
        'wonderful', 'appreciate', 'happy', 'love it', 'awesome',
        'sounds good', 'that works', 'yes please', 'absolutely',
    ];
    const negativeSignals = [
        'frustrated', 'angry', 'terrible', 'awful', 'disappointed',
        'hate', 'worst', 'unacceptable', 'ridiculous', 'waste of time',
        'not helpful', 'don\'t want', 'cancel', 'complaint',
    ];

    const posCount = positiveSignals.filter(w => lower.includes(w)).length;
    const negCount = negativeSignals.filter(w => lower.includes(w)).length;

    if (posCount > negCount + 1) return 'positive';
    if (negCount > posCount + 1) return 'negative';
    if (posCount > 0 || negCount > 0) return 'neutral';

    return undefined;
}
