import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { checkRateLimitAsync, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limit';

// Routes that don't require authentication
const publicRoutes = [
    '/login', '/signup', '/callback', '/forgot-password', '/reset-password',
    '/api/webhooks', '/api/auth', '/api/cron',
    '/api/ghl/trigger-call',
    '/api/hubspot/trigger-call',
    '/api/trigger-call',
    '/widget',        // Widget page (iframe content)
    '/api/widget',    // Widget session API
];

// Platform domains that should NOT be treated as custom domains
const PLATFORM_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'prosody.ai',
    'prosodydashboard.com',
    'vercel.app',
];

// Check if a domain is a platform domain (not a custom domain)
function isPlatformDomain(hostname: string): boolean {
    const domain = hostname.toLowerCase().split(':')[0]; // Remove port if present
    return PLATFORM_DOMAINS.some(pd =>
        domain === pd || domain.endsWith(`.${pd}`)
    );
}

// Extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
    const domain = hostname.split(':')[0]; // Remove port
    const parts = domain.split('.');

    // Need at least 3 parts for a subdomain (sub.domain.tld)
    if (parts.length < 3) return null;

    // For localhost or IP, no subdomain
    if (domain.includes('localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
        return null;
    }

    // Return the first part as subdomain
    return parts[0];
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hostname = request.headers.get('host') || 'localhost';

    // DEV ONLY: Bypass authentication for local development
    // Only works in non-production environments
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
        return NextResponse.next();
    }

    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    // Apply rate limiting to API routes (except webhooks which have their own limits)
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks')) {
        // Use stricter limit for auth endpoints
        const rateLimitConfig = pathname.startsWith('/api/auth')
            ? RATE_LIMITS.auth
            : RATE_LIMITS.api;

        const key = getRateLimitKey(ip, pathname.split('/').slice(0, 4).join('/'));
        const result = await checkRateLimitAsync(key, rateLimitConfig);

        if (!result.allowed) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': result.resetTime.toString(),
                        'X-RateLimit-Source': result.source,
                        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
                    },
                }
            );
        }
    }

    // Determine domain context for white-labeling
    // This sets headers that downstream code can use to identify the agency
    const requestHeaders = new Headers(request.headers);

    if (!isPlatformDomain(hostname)) {
        // This is a custom domain - set header for downstream lookup
        requestHeaders.set('x-custom-domain', hostname.toLowerCase().split(':')[0]);
    } else {
        // Check for subdomain-based agency routing
        const subdomain = getSubdomain(hostname);
        if (subdomain) {
            requestHeaders.set('x-agency-slug', subdomain.toLowerCase());
        }
    }

    // Allow public routes
    if (publicRoutes.some((route) => pathname.startsWith(route))) {
        const { supabaseResponse } = await updateSession(request);

        // Merge our custom headers with the Supabase response
        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        // Copy cookies from supabase response
        supabaseResponse.cookies.getAll().forEach(cookie => {
            response.cookies.set(cookie.name, cookie.value, cookie);
        });

        return response;
    }

    // Refresh session and check auth
    const { supabaseResponse, user } = await updateSession(request);

    // Redirect to login if not authenticated
    if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/signup')) {
        // For API routes, return JSON 401 instead of redirecting to HTML page
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (user && (pathname === '/login' || pathname === '/signup')) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    // Create response with custom headers for white-label context
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // Copy cookies from supabase response
    supabaseResponse.cookies.getAll().forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
