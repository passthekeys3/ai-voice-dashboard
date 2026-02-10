/**
 * Error Logger utility
 *
 * Provides centralized error logging. Add Sentry or other providers here later.
 */

export interface ErrorContext {
    userId?: string;
    agencyId?: string;
    route?: string;
    action?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Log an error with optional context
 */
export function logError(error: Error | unknown, context?: ErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error));

    console.error('[ERROR]', err.message, {
        stack: err.stack,
        ...context,
    });
}

/**
 * Log an info-level message
 */
export function logInfo(message: string, data?: Record<string, unknown>): void {
    console.log('[INFO]', message, data);
}

/**
 * Log a warning
 */
export function logWarning(message: string, data?: Record<string, unknown>): void {
    console.warn('[WARN]', message, data);
}

/**
 * Wrap an async function with error logging
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context?: Omit<ErrorContext, 'metadata'>
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            logError(error, { ...context, metadata: { args } });
            throw error;
        }
    }) as T;
}
