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
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.retellai.com https://api.vapi.ai https://api.bland.ai https://api.anthropic.com https://*.sentry.io",
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
            "media-src 'self' https: blob:",
            "worker-src 'self' blob:",
        ].join('; '),
    },
];

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
            {
                // Widget must be embeddable in iframes on third-party sites
                source: '/widget/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'ALLOWALL' },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline'",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.retellai.com https://api.vapi.ai https://api.bland.ai",
                            "media-src 'self' https: blob:",
                            "frame-ancestors *",
                        ].join('; '),
                    },
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
