/**
 * POST /api/auth/crm/sso - Decrypt GHL SSO payload
 *
 * When our app loads inside GHL's iframe, the GHL parent window sends
 * an AES-256-CBC encrypted payload containing user context (userId,
 * email, role, locationId, etc.). The frontend posts it here for
 * server-side decryption using the GHL_APP_SSO_KEY.
 *
 * Flow:
 *  1. Frontend iframe receives `REQUEST_USER_DATA_RESPONSE` postMessage
 *  2. Frontend POSTs { payload: "<base64 encrypted string>" } here
 *  3. We decrypt with AES-256-CBC (OpenSSL "Salted__" format)
 *  4. Return the decrypted user context JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const GHL_APP_SSO_KEY = process.env.GHL_APP_SSO_KEY;

interface GHLSSOContext {
    userId: string;
    companyId: string;
    activeLocation: string;
    email: string;
    role: string;
    type: string;
    userName: string;
}

/**
 * Decrypt an OpenSSL-compatible AES-256-CBC "Salted__" payload.
 *
 * OpenSSL uses a custom key derivation: the passphrase + 8-byte salt
 * are hashed with MD5 in rounds to produce key + IV material.
 */
function decryptAES256CBC(encryptedBase64: string, passphrase: string): string {
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    // OpenSSL "Salted__" format: first 8 bytes = "Salted__", next 8 = salt
    const header = encrypted.subarray(0, 8).toString('utf8');
    if (header !== 'Salted__') {
        throw new Error('Invalid encrypted payload — missing OpenSSL Salted__ header');
    }

    const salt = encrypted.subarray(8, 16);
    const ciphertext = encrypted.subarray(16);

    // OpenSSL key derivation (EVP_BytesToKey with MD5, 1 iteration)
    // For AES-256-CBC: key = 32 bytes, iv = 16 bytes → need 48 bytes total
    const passBuffer = Buffer.from(passphrase, 'utf8');
    const rounds: Buffer[] = [];
    let totalLength = 0;

    while (totalLength < 48) {
        const hashInput = rounds.length > 0
            ? Buffer.concat([rounds[rounds.length - 1], passBuffer, salt])
            : Buffer.concat([passBuffer, salt]);
        const digest = crypto.createHash('md5').update(hashInput).digest();
        rounds.push(digest);
        totalLength += digest.length;
    }

    const derived = Buffer.concat(rounds);
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32, 48);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
}

export async function POST(request: NextRequest) {
    try {
        if (!GHL_APP_SSO_KEY) {
            return NextResponse.json(
                { error: 'SSO not configured' },
                { status: 500 },
            );
        }

        const body = await request.json();
        const { payload } = body;

        if (!payload || typeof payload !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid payload' },
                { status: 400 },
            );
        }

        // Decrypt the GHL SSO payload
        let decrypted: string;
        try {
            decrypted = decryptAES256CBC(payload, GHL_APP_SSO_KEY);
        } catch {
            return NextResponse.json(
                { error: 'Failed to decrypt SSO payload' },
                { status: 401 },
            );
        }

        // Parse the decrypted JSON
        let context: GHLSSOContext;
        try {
            context = JSON.parse(decrypted);
        } catch {
            return NextResponse.json(
                { error: 'Invalid SSO payload format' },
                { status: 400 },
            );
        }

        // Validate required fields
        if (!context.userId || !context.activeLocation) {
            return NextResponse.json(
                { error: 'Incomplete SSO context' },
                { status: 400 },
            );
        }

        return NextResponse.json({
            userId: context.userId,
            companyId: context.companyId,
            activeLocation: context.activeLocation,
            email: context.email,
            role: context.role,
            type: context.type,
            userName: context.userName,
        });
    } catch (error) {
        console.error('GHL SSO decrypt error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
