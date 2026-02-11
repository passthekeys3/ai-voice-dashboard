import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
    ],
  },
  // Suppress noisy logs in production
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Security headers
  async headers() {
    return [
      // Widget routes — relaxed framing + microphone for embeddable iframe
      {
        source: '/widget/:path*',
        headers: [
          // Explicitly allow framing — overrides the catch-all /:path* rule's DENY
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: *.supabase.co *.supabase.in; connect-src 'self' *.supabase.co *.supabase.in *.retellai.com *.vapi.ai *.livekit.cloud; media-src 'self' blob: data:; font-src 'self'; frame-ancestors *;",
          },
        ],
      },
      // All other routes — strict security headers
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: *.supabase.co *.supabase.in; connect-src 'self' *.supabase.co *.supabase.in *.retellai.com *.vapi.ai *.livekit.cloud; font-src 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
