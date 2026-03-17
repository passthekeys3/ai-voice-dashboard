import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forwardToWebhook } from './forward';

// Mock Supabase client
function createMockSupabase() {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    return {
        client: {
            from: vi.fn().mockReturnValue({ insert: insertFn }),
        },
        insertFn,
    };
}

describe('forwardToWebhook', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const baseOptions = {
        webhookUrl: 'https://hook.example.com/webhook',
        payload: { event: 'call_ended', call_id: '123' },
        agencyId: 'agency-1',
        callId: 'call-1',
        event: 'call_ended',
    };

    it('returns success on 200 response', async () => {
        mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('sends JSON body with correct headers', async () => {
        mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
        const { client } = createMockSupabase();

        await forwardToWebhook(client as never, baseOptions);

        const [url, fetchOpts] = mockFetch.mock.calls[0];
        expect(url).toBe('https://hook.example.com/webhook');
        expect(fetchOpts.method).toBe('POST');
        expect(fetchOpts.headers['Content-Type']).toBe('application/json');
        expect(fetchOpts.headers['User-Agent']).toBe('Prosody-Webhook/1.0');
        expect(JSON.parse(fetchOpts.body)).toEqual(baseOptions.payload);
    });

    it('adds signing headers when signingSecret provided', async () => {
        mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
        const { client } = createMockSupabase();

        await forwardToWebhook(client as never, {
            ...baseOptions,
            signingSecret: 'my-secret',
        });

        const [, fetchOpts] = mockFetch.mock.calls[0];
        expect(fetchOpts.headers['X-Prosody-Signature']).toBeDefined();
        expect(fetchOpts.headers['X-Prosody-Timestamp']).toBeDefined();
        expect(typeof fetchOpts.headers['X-Prosody-Signature']).toBe('string');
        expect(fetchOpts.headers['X-Prosody-Signature'].length).toBe(64); // hex SHA-256
    });

    it('omits signing headers when no signingSecret', async () => {
        mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
        const { client } = createMockSupabase();

        await forwardToWebhook(client as never, baseOptions);

        const [, fetchOpts] = mockFetch.mock.calls[0];
        expect(fetchOpts.headers['X-Prosody-Signature']).toBeUndefined();
        expect(fetchOpts.headers['X-Prosody-Timestamp']).toBeUndefined();
    });

    it('blocks SSRF: private IPs are rejected without fetching', async () => {
        const { client, insertFn } = createMockSupabase();

        const result = await forwardToWebhook(client as never, {
            ...baseOptions,
            webhookUrl: 'https://192.168.1.1/webhook',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid webhook URL');
        expect(mockFetch).not.toHaveBeenCalled();
        // Should still log the blocked attempt
        expect(insertFn).toHaveBeenCalled();
    });

    it('blocks SSRF: localhost rejected', async () => {
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, {
            ...baseOptions,
            webhookUrl: 'https://localhost/webhook',
        });

        expect(result.success).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does NOT retry on 400 (non-retryable)', async () => {
        mockFetch.mockResolvedValue({ status: 400, ok: false });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('does NOT retry on 404', async () => {
        mockFetch.mockResolvedValue({ status: 404, ok: false });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 500 server error (up to 3 total attempts)', async () => {
        mockFetch.mockResolvedValue({ status: 500, ok: false });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(500);
        expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('retries on 429 rate limit', async () => {
        mockFetch.mockResolvedValue({ status: 429, ok: false });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on network error then succeeds', async () => {
        mockFetch
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce({ status: 200, ok: true });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('logs each delivery attempt to supabase', async () => {
        mockFetch
            .mockResolvedValueOnce({ status: 500, ok: false })
            .mockResolvedValueOnce({ status: 500, ok: false })
            .mockResolvedValueOnce({ status: 500, ok: false });
        const { client, insertFn } = createMockSupabase();

        await forwardToWebhook(client as never, baseOptions);

        // 3 attempts = 3 log entries
        expect(insertFn).toHaveBeenCalledTimes(3);
    });

    it('returns success on 201 response', async () => {
        mockFetch.mockResolvedValueOnce({ status: 201, ok: true });
        const { client } = createMockSupabase();

        const result = await forwardToWebhook(client as never, baseOptions);

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(201);
    });
});
