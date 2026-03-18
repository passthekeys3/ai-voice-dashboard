/**
 * Error Logger utility
 *
 * Centralized error logging with Sentry integration.
 * Falls back to console-only when SENTRY_DSN is not configured.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_ENABLED = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

/**
 * Log an error with optional context
 */
export function logError(error: Error | unknown, context?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : new Error(String(error));

    console.error('[ERROR]', err.message, {
        stack: err.stack,
        ...context,
    });

    if (SENTRY_ENABLED) {
        Sentry.captureException(err, {
            extra: context,
        });
    }
}

/**
 * Log a warning
 */
export function logWarning(message: string, data?: Record<string, unknown>): void {
    console.warn('[WARN]', message, data);

    if (SENTRY_ENABLED) {
        Sentry.captureMessage(message, {
            level: 'warning',
            extra: data,
        });
    }
}
