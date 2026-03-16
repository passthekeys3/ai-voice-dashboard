import { decrypt } from '@/lib/crypto';

const API_KEY_FIELDS = ['retell_api_key', 'vapi_api_key', 'vapi_public_key', 'bland_api_key'] as const;

/**
 * Mask provider API keys on a client record for safe frontend display.
 * Decrypts first (handles `enc:` prefix) then shows `...last4`.
 * Returns a shallow copy — does not mutate the original.
 */
export function maskClientApiKeys<T extends Record<string, unknown>>(client: T): T {
    const masked = { ...client } as Record<string, unknown>;
    for (const k of API_KEY_FIELDS) {
        const raw = masked[k];
        if (raw && typeof raw === 'string') {
            const plain = decrypt(raw) ?? raw;
            masked[k] = '...' + plain.slice(-4);
        }
    }
    return masked as T;
}
