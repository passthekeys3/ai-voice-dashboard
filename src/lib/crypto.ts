/**
 * App-level encryption for sensitive fields (API keys).
 *
 * Uses AES-256-GCM with a 32-byte key derived from the ENCRYPTION_KEY env var.
 * Each ciphertext is prefixed with "enc:" so we can distinguish encrypted
 * values from legacy plaintext values during migration.
 *
 * Format: enc:<iv_hex>:<ciphertext_hex>:<auth_tag_hex>
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = 'enc:';

/**
 * Derive a 32-byte key from the env var (supports arbitrary-length secrets).
 * Cached in module scope so we only hash once per cold start.
 */
let _derivedKey: Buffer | null = null;

function getKey(): Buffer | null {
    if (_derivedKey) return _derivedKey;

    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
        // No encryption key configured — encryption/decryption will be no-ops.
        // This is acceptable in development but should be set in production.
        return null;
    }

    // SHA-256 always produces 32 bytes regardless of input length
    _derivedKey = createHash('sha256').update(raw).digest();
    return _derivedKey;
}

/** Returns true if the value is already encrypted (has our prefix). */
export function isEncrypted(value: string): boolean {
    return value.startsWith(PREFIX);
}

/**
 * Encrypt a plaintext string. Returns the prefixed ciphertext.
 * Returns null if the input is null/undefined/empty.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    // Don't double-encrypt
    if (isEncrypted(plaintext)) return plaintext;

    const key = getKey();
    if (!key) return plaintext; // No encryption key — store as plaintext

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${PREFIX}${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt a prefixed ciphertext. Returns the plaintext.
 * If the value is NOT encrypted (no prefix), returns it as-is for
 * backward compatibility with legacy plaintext keys.
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
    if (!ciphertext) return null;
    // Legacy plaintext — return as-is
    if (!isEncrypted(ciphertext)) return ciphertext;

    const key = getKey();
    if (!key) return ciphertext; // No encryption key — return as-is

    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
