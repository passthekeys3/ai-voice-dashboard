/**
 * Next.js Instrumentation Hook
 *
 * Loads Sentry server/edge configs at startup.
 * Required for server-side error capturing in Next.js 16+.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }
}
