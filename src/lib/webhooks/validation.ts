/**
 * Webhook URL validation utilities.
 *
 * Defense-in-depth against SSRF: validates webhook URLs before forwarding
 * call data to prevent requests to internal/private addresses.
 */

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
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return false;
        if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) return false;
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
        return true;
    } catch {
        return false;
    }
}
