import { describe, it, expect } from 'vitest';
import { calculateAutoTags, calculateLeadScore } from './shared';

describe('calculateAutoTags', () => {
    it('returns always_add tags', () => {
        const tags = calculateAutoTags(
            { duration_seconds: 60 },
            { always_add: ['ai-call', 'voice-bot'] }
        );
        expect(tags).toEqual(['ai-call', 'voice-bot']);
    });

    it('adds sentiment-based tags', () => {
        const tags = calculateAutoTags(
            { sentiment: 'positive', duration_seconds: 60 },
            { sentiment_tags: { positive: ['happy-customer'], negative: ['needs-followup'] } }
        );
        expect(tags).toContain('happy-customer');
        expect(tags).not.toContain('needs-followup');
    });

    it('adds negative sentiment tags', () => {
        const tags = calculateAutoTags(
            { sentiment: 'negative', duration_seconds: 60 },
            { sentiment_tags: { positive: ['happy'], negative: ['unhappy'] } }
        );
        expect(tags).toContain('unhappy');
    });

    it('adds duration-based tags for short calls', () => {
        const tags = calculateAutoTags(
            { duration_seconds: 10 },
            { duration_tags: { short: { max_seconds: 30, tags: ['short-call'] } } }
        );
        expect(tags).toContain('short-call');
    });

    it('adds duration-based tags for long calls', () => {
        const tags = calculateAutoTags(
            { duration_seconds: 600 },
            { duration_tags: { long: { min_seconds: 300, tags: ['long-call'] } } }
        );
        expect(tags).toContain('long-call');
    });

    it('adds keyword-based tags from transcript', () => {
        const tags = calculateAutoTags(
            { duration_seconds: 60, transcript: 'I want to schedule a demo please' },
            { keyword_tags: { 'schedule': ['demo-request'], 'pricing': ['pricing-inquiry'] } }
        );
        expect(tags).toContain('demo-request');
        expect(tags).not.toContain('pricing-inquiry');
    });

    it('deduplicates tags', () => {
        const tags = calculateAutoTags(
            { sentiment: 'positive', duration_seconds: 60 },
            {
                always_add: ['ai-call'],
                sentiment_tags: { positive: ['ai-call', 'happy'] },
            }
        );
        expect(tags).toEqual(['ai-call', 'happy']);
    });

    it('returns empty array when no config matches', () => {
        const tags = calculateAutoTags({ duration_seconds: 60 }, {});
        expect(tags).toEqual([]);
    });
});

describe('calculateLeadScore', () => {
    it('returns base score when no modifiers apply', () => {
        const score = calculateLeadScore(
            { duration_seconds: 60 },
            { base_score: 50 }
        );
        expect(score).toBe(50);
    });

    it('adds positive sentiment score', () => {
        const score = calculateLeadScore(
            { sentiment: 'positive', duration_seconds: 60 },
            { base_score: 50, positive_sentiment: 15 }
        );
        expect(score).toBe(65);
    });

    it('adds negative sentiment score (negative modifier)', () => {
        const score = calculateLeadScore(
            { sentiment: 'negative', duration_seconds: 60 },
            { base_score: 50, negative_sentiment: -20 }
        );
        expect(score).toBe(30);
    });

    it('adds long call bonus', () => {
        const score = calculateLeadScore(
            { duration_seconds: 300 },
            { base_score: 50, long_call: 10, long_call_threshold: 180 }
        );
        expect(score).toBe(60);
    });

    it('applies short call penalty', () => {
        const score = calculateLeadScore(
            { duration_seconds: 10 },
            { base_score: 50, short_call: -15, short_call_threshold: 30 }
        );
        expect(score).toBe(35);
    });

    it('adds keyword scores from transcript', () => {
        const score = calculateLeadScore(
            { duration_seconds: 60, transcript: 'I need pricing information' },
            { base_score: 50, keyword_scores: { 'pricing': 10, 'cancel': -20 } }
        );
        expect(score).toBe(60);
    });

    it('clamps score to 0 minimum', () => {
        const score = calculateLeadScore(
            { sentiment: 'negative', duration_seconds: 5 },
            { base_score: 10, negative_sentiment: -30, short_call: -20, short_call_threshold: 30 }
        );
        expect(score).toBe(0);
    });

    it('clamps score to 100 maximum', () => {
        const score = calculateLeadScore(
            { sentiment: 'positive', duration_seconds: 300 },
            { base_score: 80, positive_sentiment: 25, long_call: 10, long_call_threshold: 180 }
        );
        expect(score).toBe(100);
    });
});
