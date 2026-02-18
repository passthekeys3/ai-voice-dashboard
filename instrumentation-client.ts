/**
 * Next.js Client Instrumentation
 *
 * Initializes Sentry on the client side. This file is automatically loaded
 * by Next.js 16+ (Turbopack) for browser bundles.
 *
 * Note: sentry.client.config.ts is only auto-injected by webpack.
 * For Turbopack, this file is the correct entry point.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    });
}
