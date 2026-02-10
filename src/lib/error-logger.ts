/**
 * Error Logger utility
 * 
 * Provides centralized error logging with optional Sentry integration.
 * To enable Sentry, install @sentry/nextjs and set SENTRY_DSN env var.
 */

// Check if Sentry is available (will be undefined if not installed)
let Sentry: typeof import('@sentry/nextjs') | null = null;

// Dynamically import Sentry if available
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs')
        .then((module) => {
            Sentry = module;
            console.log('Sentry error logging enabled');
        })
        .catch(() => {
            console.log('Sentry not installed - using fallback logging');
        });
}

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

    // Always log to console
    console.error('[ERROR]', err.message, {
        stack: err.stack,
        ...context,
    });

    // Send to Sentry if available
    if (Sentry) {
        const sentry = Sentry;
        sentry.withScope((scope) => {
            if (context?.userId) scope.setUser({ id: context.userId });
            if (context?.agencyId) scope.setTag('agency_id', context.agencyId);
            if (context?.route) scope.setTag('route', context.route);
            if (context?.action) scope.setTag('action', context.action);
            if (context?.metadata) scope.setExtras(context.metadata);

            sentry.captureException(err);
        });
    }
}

/**
 * Log an info-level message 
 */
export function logInfo(message: string, data?: Record<string, unknown>): void {
    console.log('[INFO]', message, data);

    if (Sentry) {
        Sentry.addBreadcrumb({
            category: 'info',
            message,
            data,
            level: 'info',
        });
    }
}

/**
 * Log a warning
 */
export function logWarning(message: string, data?: Record<string, unknown>): void {
    console.warn('[WARN]', message, data);

    if (Sentry) {
        Sentry.captureMessage(message, {
            level: 'warning',
            extra: data,
        });
    }
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
