import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,

        // Sample 10% of transactions for performance monitoring
        tracesSampleRate: 0.1,

        // Capture 100% of errors (default)
        // Session replay is disabled to keep bundle size down
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,

        // Filter out noisy client-side errors
        ignoreErrors: [
            // Browser extensions and third-party scripts
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            // Network errors (user's connection dropped)
            'Failed to fetch',
            'NetworkError',
            'Load failed',
        ],
    });
}
