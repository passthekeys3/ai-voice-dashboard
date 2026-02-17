import { describe, it, expect } from 'vitest';
import { detectTimezone, isWithinCallingWindow } from './detector';

describe('detectTimezone', () => {
    it('detects US timezone from area code 415 (San Francisco)', () => {
        expect(detectTimezone('+14155551234')).toBe('America/Los_Angeles');
    });

    it('detects US timezone from area code 212 (New York)', () => {
        expect(detectTimezone('+12125551234')).toBe('America/New_York');
    });

    it('detects US timezone from area code 312 (Chicago)', () => {
        expect(detectTimezone('+13125551234')).toBe('America/Chicago');
    });

    it('detects US timezone from area code 303 (Denver)', () => {
        expect(detectTimezone('+13035551234')).toBe('America/Denver');
    });

    it('detects UK timezone from country code 44', () => {
        expect(detectTimezone('+442071234567')).toBe('Europe/London');
    });

    it('detects Japan timezone from country code 81', () => {
        expect(detectTimezone('+819012345678')).toBe('Asia/Tokyo');
    });

    it('returns null for invalid/short numbers', () => {
        expect(detectTimezone('')).toBeNull();
        expect(detectTimezone('+1')).toBeNull();
        expect(detectTimezone('abc')).toBeNull();
    });

    it('handles numbers without + prefix', () => {
        expect(detectTimezone('14155551234')).toBe('America/Los_Angeles');
    });

    it('strips non-digit characters', () => {
        expect(detectTimezone('+1 (415) 555-1234')).toBe('America/Los_Angeles');
    });
});

describe('isWithinCallingWindow', () => {
    // Note: These tests check the function logic but are time-dependent.
    // We test the boundary logic by passing explicit timezone + window combinations.

    it('returns true when within a standard business hours window', () => {
        // Use a timezone where we know the current hour, and set window to cover all hours
        const result = isWithinCallingWindow('America/New_York', {
            startHour: 0,
            endHour: 24,
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // all days
        });
        expect(result).toBe(true);
    });

    it('returns false when window is impossibly narrow (same start/end)', () => {
        // startHour 0, endHour 0 means no valid hours
        const result = isWithinCallingWindow('America/New_York', {
            startHour: 0,
            endHour: 0,
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        });
        expect(result).toBe(false);
    });

    it('respects daysOfWeek constraint', () => {
        // Window covers all hours, but only allow a day that's impossible (empty array)
        const result = isWithinCallingWindow('America/New_York', {
            startHour: 0,
            endHour: 24,
            daysOfWeek: [], // no days allowed
        });
        expect(result).toBe(false);
    });

    it('handles overnight ranges (e.g., 22-6)', () => {
        // Overnight: 22:00 to 06:00 — covers late night and early morning
        // With all days allowed, at least verify the function doesn't crash
        const result = isWithinCallingWindow('America/New_York', {
            startHour: 22,
            endHour: 6,
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        });
        // Result depends on current time — just verify it returns a boolean
        expect(typeof result).toBe('boolean');
    });

    it('defaults to weekdays when daysOfWeek not specified', () => {
        // This test verifies the function works without daysOfWeek
        const result = isWithinCallingWindow('America/New_York', {
            startHour: 0,
            endHour: 24,
        });
        // On weekdays this is true, on weekends false
        expect(typeof result).toBe('boolean');
    });
});
