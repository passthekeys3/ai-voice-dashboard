import { describe, it, expect } from 'vitest';
import { getProviderKey, autoSelectProvider } from './resolve-keys';
import type { ResolvedApiKeys } from './resolve-keys';

describe('getProviderKey', () => {
    const keys: ResolvedApiKeys = {
        retell_api_key: 'retell-key-123',
        vapi_api_key: 'vapi-key-456',
        bland_api_key: null,
        source: { retell: 'agency', vapi: 'client', bland: null },
    };

    it('returns retell key for retell provider', () => {
        expect(getProviderKey(keys, 'retell')).toBe('retell-key-123');
    });

    it('returns vapi key for vapi provider', () => {
        expect(getProviderKey(keys, 'vapi')).toBe('vapi-key-456');
    });

    it('returns null when provider key is not set', () => {
        expect(getProviderKey(keys, 'bland')).toBeNull();
    });
});

describe('autoSelectProvider', () => {
    it('selects retell when available (highest priority)', () => {
        const keys: ResolvedApiKeys = {
            retell_api_key: 'retell-key',
            vapi_api_key: 'vapi-key',
            bland_api_key: 'bland-key',
            source: { retell: 'agency', vapi: 'agency', bland: 'agency' },
        };
        const result = autoSelectProvider(keys);
        expect(result).toEqual({ provider: 'retell', apiKey: 'retell-key' });
    });

    it('falls back to vapi when retell is missing', () => {
        const keys: ResolvedApiKeys = {
            retell_api_key: null,
            vapi_api_key: 'vapi-key',
            bland_api_key: 'bland-key',
            source: { retell: null, vapi: 'agency', bland: 'agency' },
        };
        const result = autoSelectProvider(keys);
        expect(result).toEqual({ provider: 'vapi', apiKey: 'vapi-key' });
    });

    it('falls back to bland when retell and vapi are missing', () => {
        const keys: ResolvedApiKeys = {
            retell_api_key: null,
            vapi_api_key: null,
            bland_api_key: 'bland-key',
            source: { retell: null, vapi: null, bland: 'client' },
        };
        const result = autoSelectProvider(keys);
        expect(result).toEqual({ provider: 'bland', apiKey: 'bland-key' });
    });

    it('returns null when no providers are configured', () => {
        const keys: ResolvedApiKeys = {
            retell_api_key: null,
            vapi_api_key: null,
            bland_api_key: null,
            source: { retell: null, vapi: null, bland: null },
        };
        expect(autoSelectProvider(keys)).toBeNull();
    });
});
