import { describe, it, expect, vi } from 'vitest';
import { withRetry, fetchWithRetry, HttpRetryError } from './retry';

describe('withRetry', () => {
    it('succeeds on first try without retrying', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await withRetry(fn, { baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on TypeError (network error) and succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValue('ok');
        const result = await withRetry(fn, { baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on HttpRetryError with retryable status', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new HttpRetryError(500, 'http://test'))
            .mockRejectedValueOnce(new HttpRetryError(502, 'http://test'))
            .mockResolvedValue('ok');
        const result = await withRetry(fn, { baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('stops retrying after maxRetries', async () => {
        const fn = vi.fn().mockRejectedValue(new HttpRetryError(500, 'http://test'));
        await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('does not retry non-retryable errors (e.g., 404)', async () => {
        const fn = vi.fn().mockRejectedValue(new HttpRetryError(404, 'http://test'));
        await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1); // no retry
    });

    it('does not retry generic errors without retryable status', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Something broke'));
        await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('Something broke');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries generic errors that mention retryable status codes', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('API error: 429 too many requests'))
            .mockResolvedValue('ok');
        const result = await withRetry(fn, { baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('calls onRetry callback with correct arguments', async () => {
        const onRetry = vi.fn();
        const fn = vi.fn()
            .mockRejectedValueOnce(new HttpRetryError(503, 'http://test'))
            .mockResolvedValue('ok');
        await withRetry(fn, { baseDelayMs: 1, onRetry });
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(HttpRetryError), expect.any(Number));
    });

    it('respects custom retryableStatuses', async () => {
        const fn = vi.fn().mockRejectedValue(new HttpRetryError(418, 'http://test'));
        // 418 is not in default retryable statuses
        await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1);

        // Now with custom statuses including 418
        fn.mockClear();
        fn.mockRejectedValueOnce(new HttpRetryError(418, 'http://test'))
            .mockResolvedValue('ok');
        const result = await withRetry(fn, { baseDelayMs: 1, retryableStatuses: [418] });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('HttpRetryError', () => {
    it('has correct status, url, and message', () => {
        const err = new HttpRetryError(429, 'https://api.example.com/data');
        expect(err.status).toBe(429);
        expect(err.url).toBe('https://api.example.com/data');
        expect(err.message).toBe('HTTP 429 from https://api.example.com/data');
        expect(err.name).toBe('HttpRetryError');
    });
});

describe('fetchWithRetry', () => {
    it('retries on 500 and succeeds on second attempt', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
            .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
        vi.stubGlobal('fetch', mockFetch);

        const response = await fetchWithRetry('http://test', {}, { baseDelayMs: 1 });
        expect(response.ok).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        vi.unstubAllGlobals();
    });

    it('does not retry on 400 (client error)', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValue({ ok: false, status: 400 } as Response);
        vi.stubGlobal('fetch', mockFetch);

        const response = await fetchWithRetry('http://test', {}, { baseDelayMs: 1 });
        expect(response.status).toBe(400);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        vi.unstubAllGlobals();
    });

    it('retries on 429 rate limit', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
            .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
        vi.stubGlobal('fetch', mockFetch);

        const response = await fetchWithRetry('http://test', {}, { baseDelayMs: 1 });
        expect(response.ok).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        vi.unstubAllGlobals();
    });
});
