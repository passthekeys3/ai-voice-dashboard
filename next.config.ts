import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
    // Suppress Sentry CLI output during build
    silent: true,
    // Delete source maps after upload so they're not exposed to the client
    sourcemaps: {
        deleteSourcemapsAfterUpload: true,
    },
});
