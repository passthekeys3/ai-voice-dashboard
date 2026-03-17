import { describe, it, expect } from 'vitest';
import { normalizePhoneToE164 } from './phone';

describe('normalizePhoneToE164', () => {
    it('passes through valid E.164 numbers', () => {
        const result = normalizePhoneToE164('+14155551234');
        expect(result).toEqual({ phone: '+14155551234' });
    });

    it('adds +1 prefix for 10-digit US numbers', () => {
        const result = normalizePhoneToE164('4155551234');
        expect(result).toEqual({ phone: '+14155551234' });
    });

    it('adds + prefix for 11-digit numbers starting with 1', () => {
        const result = normalizePhoneToE164('14155551234');
        expect(result).toEqual({ phone: '+14155551234' });
    });

    it('strips whitespace, dashes, and parentheses', () => {
        const result = normalizePhoneToE164('(415) 555-1234');
        expect(result).toEqual({ phone: '+14155551234' });
    });

    it('handles spaces and dashes in international numbers', () => {
        const result = normalizePhoneToE164('+44 20-7946-0958');
        expect(result).toEqual({ phone: '+442079460958' });
    });

    it('rejects too-short numbers', () => {
        const result = normalizePhoneToE164('12345');
        expect(result).toHaveProperty('error');
    });

    it('rejects numbers without valid country code', () => {
        const result = normalizePhoneToE164('+0123456789');
        expect(result).toHaveProperty('error');
    });

    it('rejects empty string', () => {
        const result = normalizePhoneToE164('');
        expect(result).toHaveProperty('error');
    });

    it('rejects letters', () => {
        const result = normalizePhoneToE164('abc1234567');
        expect(result).toHaveProperty('error');
    });
});
