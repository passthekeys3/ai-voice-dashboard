import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEncrypted } from './crypto';

// We need to reset the cached key between tests since crypto.ts caches _derivedKey
// The simplest way is to re-import the module fresh for each test group

describe('crypto', () => {
    const TEST_KEY = '81deafdb38103db31046c39dfe607efa71f63106dcfd9658bb99c946be5c7e8a';

    beforeEach(() => {
        // Reset the module-level cached key by clearing the module cache
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('isEncrypted', () => {
        it('returns true for enc: prefixed values', () => {
            expect(isEncrypted('enc:abc:def:ghi')).toBe(true);
        });

        it('returns false for plaintext values', () => {
            expect(isEncrypted('sk-1234567890')).toBe(false);
        });

        it('returns false for empty-ish strings', () => {
            expect(isEncrypted('')).toBe(false);
        });
    });

    describe('with ENCRYPTION_KEY set', () => {
        it('encrypts and decrypts a value round-trip', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { encrypt, decrypt } = await import('./crypto');

            const plaintext = 'sk-retell-test-key-abc123';
            const encrypted = encrypt(plaintext);

            expect(encrypted).not.toBeNull();
            expect(encrypted).not.toBe(plaintext);
            expect(encrypted!.startsWith('enc:')).toBe(true);

            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('produces different ciphertexts for the same input (random IV)', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { encrypt } = await import('./crypto');

            const plaintext = 'sk-retell-test-key-abc123';
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('does not double-encrypt already encrypted values', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { encrypt } = await import('./crypto');

            const plaintext = 'sk-retell-test-key-abc123';
            const encrypted = encrypt(plaintext)!;
            const doubleEncrypted = encrypt(encrypted);

            expect(doubleEncrypted).toBe(encrypted);
        });

        it('returns null for null/undefined/empty input', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { encrypt, decrypt } = await import('./crypto');

            expect(encrypt(null)).toBeNull();
            expect(encrypt(undefined)).toBeNull();
            expect(encrypt('')).toBeNull();
            expect(decrypt(null)).toBeNull();
            expect(decrypt(undefined)).toBeNull();
            expect(decrypt('')).toBeNull();
        });

        it('decrypt returns plaintext as-is for legacy unencrypted values', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { decrypt } = await import('./crypto');

            const legacy = 'sk-plaintext-legacy-key';
            expect(decrypt(legacy)).toBe(legacy);
        });

        it('throws on malformed encrypted values', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { decrypt } = await import('./crypto');

            expect(() => decrypt('enc:only-one-part')).toThrow('Invalid encrypted value format');
        });

        it('fails to decrypt with wrong key', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { encrypt } = await import('./crypto');
            const encrypted = encrypt('secret-api-key')!;

            // Re-import with a different key
            vi.resetModules();
            vi.stubEnv('ENCRYPTION_KEY', 'completely-different-key-for-testing');
            const { decrypt: decryptWrongKey } = await import('./crypto');

            expect(() => decryptWrongKey(encrypted)).toThrow();
        });

        it('handles various API key formats correctly', async () => {
            vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
            const { encrypt, decrypt } = await import('./crypto');

            const keys = [
                'key_abc123def456',
                'sk-retell-abcdefghijklmnop',
                'vapi_pk_1234567890abcdef',
                'org-bland-xyz-987654321',
                'a'.repeat(200), // long key
            ];

            for (const key of keys) {
                const encrypted = encrypt(key);
                expect(encrypted).not.toBeNull();
                expect(decrypt(encrypted)).toBe(key);
            }
        });
    });

    describe('without ENCRYPTION_KEY', () => {
        it('encrypt returns plaintext as-is (no-op)', async () => {
            vi.stubEnv('ENCRYPTION_KEY', '');
            const { encrypt } = await import('./crypto');

            const plaintext = 'sk-retell-test-key';
            expect(encrypt(plaintext)).toBe(plaintext);
        });

        it('decrypt returns value as-is', async () => {
            vi.stubEnv('ENCRYPTION_KEY', '');
            const { decrypt } = await import('./crypto');

            expect(decrypt('sk-retell-test-key')).toBe('sk-retell-test-key');
            expect(decrypt('enc:abc:def:ghi')).toBe('enc:abc:def:ghi');
        });
    });
});
