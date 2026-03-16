/**
 * Webhook URL validation and signing utilities.
 *
 * Defense-in-depth against SSRF: validates webhook URLs before forwarding
 * call data to prevent requests to internal/private addresses.
 *
 * HMAC signing for outbound webhooks: allows recipients (Zapier, Make, n8n)
 * to verify payloads authentically came from Prosody.
 */

import crypto from 'crypto';

/**
 * Sign a webhook payload using HMAC-SHA256.
 * Format mirrors Stripe: signature = HMAC-SHA256(secret, "${timestamp}.${body}")
 * Recipients verify by recomputing the hash and comparing.
 */
export function signWebhookPayload(body: string, secret: string, timestamp: number): string {
    return crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
}

/**
 * Validate that a webhook URL is safe to forward data to.
 * Blocks:
 *  - Non-HTTPS URLs
 *  - Localhost and loopback addresses
 *  - Private/internal IP ranges (RFC 1918, link-local)
 */
export function isValidWebhookUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname;
        // Note: URL.hostname returns '[::1]' (with brackets) for IPv6
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host === '[::1]') return false;
        // Block all IPv6 literal addresses (prevents mapped IPv4, link-local, unique-local bypasses)
        if (host.startsWith('[') || host.includes(':')) return false;
        if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) return false;
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
        return true;
    } catch {
        return false;
    }
}
