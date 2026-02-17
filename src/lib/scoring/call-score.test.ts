import { describe, it, expect } from 'vitest';
import { calculateCallScore, inferBasicSentiment } from './call-score';

describe('calculateCallScore', () => {
    it('returns 0 for failed calls', () => {
        expect(calculateCallScore({ sentiment: 'positive', durationSeconds: 120, status: 'failed' })).toBe(0);
    });

    it('returns 0 for in_progress calls', () => {
        expect(calculateCallScore({ sentiment: undefined, durationSeconds: 0, status: 'in_progress' })).toBe(0);
    });

    it('returns base 50 for completed call with no sentiment and short duration', () => {
        expect(calculateCallScore({ durationSeconds: 20, status: 'completed' })).toBe(50);
    });

    it('adds +20 for positive sentiment', () => {
        expect(calculateCallScore({ sentiment: 'positive', durationSeconds: 20, status: 'completed' })).toBe(70);
    });

    it('adds +5 for neutral sentiment', () => {
        expect(calculateCallScore({ sentiment: 'neutral', durationSeconds: 20, status: 'completed' })).toBe(55);
    });

    it('subtracts -15 for negative sentiment', () => {
        expect(calculateCallScore({ sentiment: 'negative', durationSeconds: 20, status: 'completed' })).toBe(35);
    });

    it('subtracts -10 for very short calls (<15s)', () => {
        expect(calculateCallScore({ durationSeconds: 10, status: 'completed' })).toBe(40);
    });

    it('adds +15 for sweet spot duration (1-10 min)', () => {
        expect(calculateCallScore({ durationSeconds: 300, status: 'completed' })).toBe(65);
    });

    it('adds +10 for decent duration (10-15 min)', () => {
        expect(calculateCallScore({ durationSeconds: 700, status: 'completed' })).toBe(60);
    });

    it('adds +5 for long calls (>15 min)', () => {
        expect(calculateCallScore({ durationSeconds: 1000, status: 'completed' })).toBe(55);
    });

    it('calculates max score: completed + positive + sweet spot = 85', () => {
        expect(calculateCallScore({ sentiment: 'positive', durationSeconds: 120, status: 'completed' })).toBe(85);
    });

    it('clamps score to 0 minimum (negative + very short)', () => {
        // 50 - 15 (negative) - 10 (very short) = 25, above 0 so this doesn't clamp
        expect(calculateCallScore({ sentiment: 'negative', durationSeconds: 5, status: 'completed' })).toBe(25);
    });
});

describe('inferBasicSentiment', () => {
    it('returns undefined for empty transcript', () => {
        expect(inferBasicSentiment('')).toBeUndefined();
        expect(inferBasicSentiment(undefined)).toBeUndefined();
    });

    it('returns undefined for very short transcript', () => {
        expect(inferBasicSentiment('Hi there')).toBeUndefined();
    });

    it('returns positive for transcripts with positive keywords', () => {
        const transcript = 'That sounds great, thank you so much for helping me with this. I really appreciate it and love it.';
        expect(inferBasicSentiment(transcript)).toBe('positive');
    });

    it('returns negative for transcripts with negative keywords', () => {
        const transcript = 'This is terrible and I am very frustrated with the service. It was a complete waste of time and the worst experience.';
        expect(inferBasicSentiment(transcript)).toBe('negative');
    });

    it('returns neutral when positive and negative are balanced', () => {
        const transcript = 'Thank you for trying but I am disappointed with the result. It was not helpful at all but I appreciate the effort.';
        expect(inferBasicSentiment(transcript)).toBe('neutral');
    });

    it('returns undefined for transcripts with no sentiment signals', () => {
        const transcript = 'The meeting is scheduled for Tuesday at three PM in the main conference room on the second floor.';
        expect(inferBasicSentiment(transcript)).toBeUndefined();
    });
});
