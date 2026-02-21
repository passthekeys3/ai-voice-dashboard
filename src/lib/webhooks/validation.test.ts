import { describe, it, expect } from 'vitest';
import { isValidWebhookUrl } from './validation';

describe('isValidWebhookUrl', () => {
    // Valid URLs
    it('accepts valid HTTPS URLs', () => {
        expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
        expect(isValidWebhookUrl('https://api.mysite.com/hooks/call')).toBe(true);
        expect(isValidWebhookUrl('https://webhook.site/abc-123')).toBe(true);
    });

    it('accepts HTTPS URLs with ports', () => {
        expect(isValidWebhookUrl('https://example.com:8443/webhook')).toBe(true);
    });

    // Protocol checks
    it('rejects HTTP URLs', () => {
        expect(isValidWebhookUrl('http://example.com/webhook')).toBe(false);
    });

    it('rejects non-HTTP protocols', () => {
        expect(isValidWebhookUrl('ftp://example.com/file')).toBe(false);
        expect(isValidWebhookUrl('file:///etc/passwd')).toBe(false);
    });

    // Localhost / loopback
    it('rejects localhost', () => {
        expect(isValidWebhookUrl('https://localhost/webhook')).toBe(false);
        expect(isValidWebhookUrl('https://localhost:3000/webhook')).toBe(false);
    });

    it('rejects IPv4 loopback', () => {
        expect(isValidWebhookUrl('https://127.0.0.1/webhook')).toBe(false);
    });

    it('rejects IPv6 loopback', () => {
        expect(isValidWebhookUrl('https://[::1]/webhook')).toBe(false);
    });

    // Private IP ranges (RFC 1918)
    it('rejects 10.x.x.x private range', () => {
        expect(isValidWebhookUrl('https://10.0.0.1/webhook')).toBe(false);
        expect(isValidWebhookUrl('https://10.255.255.255/webhook')).toBe(false);
    });

    it('rejects 192.168.x.x private range', () => {
        expect(isValidWebhookUrl('https://192.168.0.1/webhook')).toBe(false);
        expect(isValidWebhookUrl('https://192.168.1.100/webhook')).toBe(false);
    });

    it('rejects 172.16-31.x.x private range', () => {
        expect(isValidWebhookUrl('https://172.16.0.1/webhook')).toBe(false);
        expect(isValidWebhookUrl('https://172.31.255.255/webhook')).toBe(false);
    });

    it('allows 172.x outside private range', () => {
        expect(isValidWebhookUrl('https://172.15.0.1/webhook')).toBe(true);
        expect(isValidWebhookUrl('https://172.32.0.1/webhook')).toBe(true);
    });

    // Link-local
    it('rejects 169.254.x.x link-local range', () => {
        expect(isValidWebhookUrl('https://169.254.1.1/webhook')).toBe(false);
    });

    // Invalid URLs
    it('rejects malformed URLs', () => {
        expect(isValidWebhookUrl('not-a-url')).toBe(false);
        expect(isValidWebhookUrl('')).toBe(false);
    });
});
