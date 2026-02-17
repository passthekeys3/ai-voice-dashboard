/**
 * Shared retry utility with exponential backoff.
 *
 * Used by provider API clients and CRM integrations to handle transient
 * failures (network errors, rate limits, 5xx responses) without custom
 * retry logic in every call site.
 */

export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in ms — doubles on each retry (default: 200) */
    baseDelayMs?: number;
    /** Maximum delay cap in ms (default: 5000) */
    maxDelayMs?: number;
    /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
    retryableStatuses?: number[];
    /** Called on each retry attempt for logging/observability */
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

/**
 * Execute an async function with exponential backoff retries.
 *
 * @example
 * ```ts
 * const data = await withRetry(() => fetch(url).then(r => {
 *     if (!r.ok) throw new HttpError(r.status);
 *     return r.json();
 * }));
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 200,
        maxDelayMs = 5000,
        onRetry,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on the last attempt
            if (attempt >= maxRetries) break;

            // Only retry on retryable errors
            if (!isRetryable(error, options.retryableStatuses)) break;

            // Exponential backoff with jitter
            const delay = Math.min(
                baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
                maxDelayMs,
            );

            onRetry?.(attempt + 1, error, delay);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Retry wrapper specifically for fetch-based API calls.
 * Automatically handles response status checking and retries on transient HTTP errors.
 *
 * @example
 * ```ts
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 * });
 * ```
 */
export async function fetchWithRetry(
    url: string,
    init: RequestInit = {},
    options: RetryOptions = {},
): Promise<Response> {
    const retryableStatuses = options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

    return withRetry(async () => {
        const response = await fetch(url, init);
        if (!response.ok && retryableStatuses.includes(response.status)) {
            throw new HttpRetryError(response.status, url);
        }
        return response;
    }, options);
}

/** Error class for HTTP status-based retries */
export class HttpRetryError extends Error {
    constructor(public status: number, public url: string) {
        super(`HTTP ${status} from ${url}`);
        this.name = 'HttpRetryError';
    }
}

function isRetryable(error: unknown, statuses?: number[]): boolean {
    // Network errors (fetch failures) are always retryable
    if (error instanceof TypeError) return true;

    // HTTP retry errors
    if (error instanceof HttpRetryError) {
        const retryableStatuses = statuses ?? DEFAULT_RETRYABLE_STATUSES;
        return retryableStatuses.includes(error.status);
    }

    // Generic errors with retryable status codes in the message
    if (error instanceof Error) {
        const match = error.message.match(/\b(429|500|502|503|504)\b/);
        if (match) return true;
    }

    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
