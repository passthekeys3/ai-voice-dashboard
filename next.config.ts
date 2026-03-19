import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.retellai.com https://api.vapi.ai https://api.bland.ai https://api.anthropic.com https://*.ingest.us.sentry.io https://*.sentry.io https://va.vercel-scripts.com https://vitals.vercel-analytics.com",
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
            "media-src 'self' https: blob:",
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
        ].join('; '),
    },
];

const nextConfig: NextConfig = {
    turbopack: {
        root: __dirname,
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
            {
                // Widget must be embeddable in iframes on third-party sites
                // CSP frame-ancestors * below handles iframe embedding (X-Frame-Options omitted — ALLOWALL is not a valid value)
                source: '/widget/:path*',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https:",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.retellai.com https://api.vapi.ai https://api.bland.ai",
                            "media-src 'self' https: blob:",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "frame-ancestors *",
                        ].join('; '),
                    },
                ],
            },
            {
                // Widget session API — called cross-origin from embedded widget on customer sites
                source: '/api/widget/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
                ],
            },
            {
                // External trigger API — called from Make.com, Zapier, n8n, etc.
                source: '/api/trigger-call',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                ],
            },
        ];
    },
};

export default withSentryConfig(nextConfig, {
    // Suppress Sentry CLI output during build
    silent: true,
    // Delete source maps after upload so they're not exposed to the client
    sourcemaps: {
        deleteSourcemapsAfterUpload: true,
    },
});
