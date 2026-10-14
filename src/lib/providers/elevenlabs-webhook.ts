/**
 * ElevenLabs post-call webhook registration and signature verification.
 *
 * ElevenLabs sends post-call data to a workspace webhook that agents reference by id.
 * We register one webhook per API key (client, agency, or platform) and store its
 * signing secret in `elevenlabs_webhooks`, keyed by a hash of the key (migration 051).
 */

import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/crypto';
import { createElevenLabsWorkspaceWebhook } from './elevenlabs';

/** Same tolerance as the official SDK's constructEvent */
const SIGNATURE_TOLERANCE_MS = 30 * 60 * 1000;

export function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/** Signing secret of the webhook registered for this API key, or null if none */
export async function getElevenLabsWebhookSecret(apiKey: string): Promise<string | null> {
    const supabase = createServiceClient();
    const { data } = await supabase
        .from('elevenlabs_webhooks')
        .select('webhook_secret')
        .eq('api_key_hash', hashApiKey(apiKey))
        .maybeSingle();
    return data?.webhook_secret ? decrypt(data.webhook_secret) : null;
}

/**
 * Return the id of this API key's post-call webhook, registering one with
 * ElevenLabs on first use. Returns null (and logs) if it can't, so agent
 * creation still succeeds; the nightly sync retries.
 */
export async function ensureElevenLabsWebhook(apiKey: string): Promise<string | null> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        console.warn('[elevenlabs] NEXT_PUBLIC_APP_URL not set; cannot register post-call webhook');
        return null;
    }

    try {
        const supabase = createServiceClient();
        const apiKeyHash = hashApiKey(apiKey);

        const { data: existing } = await supabase
            .from('elevenlabs_webhooks')
            .select('webhook_id')
            .eq('api_key_hash', apiKeyHash)
            .maybeSingle();
        if (existing?.webhook_id) return existing.webhook_id;

        const created = await createElevenLabsWorkspaceWebhook(apiKey, {
            name: 'BuildVoiceAI post-call',
            url: `${appUrl}/api/webhooks/elevenlabs`,
        });
        if (!created.webhook_secret) {
            console.error('[elevenlabs] Webhook created without a signing secret; not using it');
            return null;
        }

        // A concurrent request may have registered one first: keep whichever row won
        const { error } = await supabase
            .from('elevenlabs_webhooks')
            .insert({
                api_key_hash: apiKeyHash,
                webhook_id: created.webhook_id,
                webhook_secret: encrypt(created.webhook_secret),
            });
        if (error?.code === '23505') {
            const { data: winner } = await supabase
                .from('elevenlabs_webhooks')
                .select('webhook_id')
                .eq('api_key_hash', apiKeyHash)
                .single();
            return winner?.webhook_id ?? null;
        }
        if (error) {
            console.error('[elevenlabs] Failed to store webhook secret:', error.code);
            return null;
        }
        return created.webhook_id;
    } catch (err) {
        console.error('[elevenlabs] Failed to register post-call webhook:', err instanceof Error ? err.message : 'Unknown error');
        return null;
    }
}

/**
 * Verify an `ElevenLabs-Signature` header (`t=<unix secs>,v0=<hex HMAC-SHA256 of "<t>.<body>">`),
 * matching the SDK's constructEvent, with a constant-time comparison.
 */
export function verifyElevenLabsSignature(
    rawBody: string,
    signatureHeader: string | null,
    secret: string,
    nowMs: number = Date.now(),
): boolean {
    if (!signatureHeader || !secret) return false;

    const parts = signatureHeader.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const signature = parts.find(p => p.startsWith('v0='));
    if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;

    if (Number(timestamp) * 1000 < nowMs - SIGNATURE_TOLERANCE_MS) return false;

    const expected = 'v0=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    return signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
