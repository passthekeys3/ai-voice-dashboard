/**
 * Shared Integration Functions
 *
 * Provider-agnostic pure functions for call data processing.
 * Used by both GHL and HubSpot integrations.
 */

/**
 * Apply auto-tags based on call data
 */
export function calculateAutoTags(
    callData: {
        sentiment?: string;
        duration_seconds: number;
        transcript?: string;
    },
    config: {
        sentiment_tags?: Record<string, string[]>;
        duration_tags?: { short?: { max_seconds: number; tags: string[] }; long?: { min_seconds: number; tags: string[] } };
        keyword_tags?: Record<string, string[]>;
        always_add?: string[];
    }
): string[] {
    const tags: string[] = [];

    // Always add tags
    if (config.always_add) {
        tags.push(...config.always_add);
    }

    // Sentiment-based tags
    if (config.sentiment_tags && callData.sentiment) {
        const sentimentLower = callData.sentiment.toLowerCase();
        if (sentimentLower.includes('positive') && config.sentiment_tags.positive) {
            tags.push(...config.sentiment_tags.positive);
        } else if (sentimentLower.includes('negative') && config.sentiment_tags.negative) {
            tags.push(...config.sentiment_tags.negative);
        } else if (config.sentiment_tags.neutral) {
            tags.push(...config.sentiment_tags.neutral);
        }
    }

    // Duration-based tags
    if (config.duration_tags) {
        if (config.duration_tags.short && callData.duration_seconds <= config.duration_tags.short.max_seconds) {
            tags.push(...config.duration_tags.short.tags);
        }
        if (config.duration_tags.long && callData.duration_seconds >= config.duration_tags.long.min_seconds) {
            tags.push(...config.duration_tags.long.tags);
        }
    }

    // Keyword-based tags
    if (config.keyword_tags && callData.transcript) {
        const transcriptLower = callData.transcript.toLowerCase();
        for (const [keyword, keywordTags] of Object.entries(config.keyword_tags)) {
            if (transcriptLower.includes(keyword.toLowerCase())) {
                tags.push(...keywordTags);
            }
        }
    }

    // Remove duplicates
    return [...new Set(tags)];
}

/**
 * Calculate lead qualification score based on call data
 */
export function calculateLeadScore(
    callData: {
        sentiment?: string;
        duration_seconds: number;
        transcript?: string;
    },
    scoringRules: {
        positive_sentiment?: number;
        negative_sentiment?: number;
        neutral_sentiment?: number;
        long_call?: number;
        short_call?: number;
        long_call_threshold?: number;
        short_call_threshold?: number;
        keyword_scores?: Record<string, number>;
        base_score?: number;
    }
): number {
    let score = scoringRules.base_score || 50;

    // Sentiment scoring
    if (callData.sentiment) {
        const sentimentLower = callData.sentiment.toLowerCase();
        if (sentimentLower.includes('positive') && scoringRules.positive_sentiment) {
            score += scoringRules.positive_sentiment;
        } else if (sentimentLower.includes('negative') && scoringRules.negative_sentiment) {
            score += scoringRules.negative_sentiment;
        } else if (scoringRules.neutral_sentiment) {
            score += scoringRules.neutral_sentiment;
        }
    }

    // Duration scoring
    const longThreshold = scoringRules.long_call_threshold || 180;
    const shortThreshold = scoringRules.short_call_threshold || 30;

    if (callData.duration_seconds >= longThreshold && scoringRules.long_call) {
        score += scoringRules.long_call;
    } else if (callData.duration_seconds <= shortThreshold && scoringRules.short_call) {
        score += scoringRules.short_call;
    }

    // Keyword scoring
    if (scoringRules.keyword_scores && callData.transcript) {
        const transcriptLower = callData.transcript.toLowerCase();
        for (const [keyword, keywordScore] of Object.entries(scoringRules.keyword_scores)) {
            if (transcriptLower.includes(keyword.toLowerCase())) {
                score += keywordScore;
            }
        }
    }

    // Clamp score between 0 and 100
    return Math.max(0, Math.min(100, score));
}
