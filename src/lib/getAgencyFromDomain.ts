import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import type { AgencyBranding } from '@/types';

// Platform domains that should NOT be treated as custom domains
const PLATFORM_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'buildvoiceai.com',
    'vercel.app',
];

// Check if a domain is a platform domain (not a custom domain)
export function isPlatformDomain(hostname: string): boolean {
    const domain = hostname.toLowerCase().split(':')[0]; // Strip port
    return PLATFORM_DOMAINS.some(pd =>
        domain === pd || domain.endsWith(`.${pd}`)
    );
}

// Extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
    const domain = hostname.split(':')[0]; // Strip port
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

export interface AgencyFromDomain {
    id: string;
    name: string;
    slug?: string;
    branding?: AgencyBranding;
    domain_verified?: boolean;
    matchType: 'custom_domain' | 'subdomain' | 'default';
}

/**
 * Internal lookup — not called directly, wrapped with unstable_cache below.
 */
async function lookupAgencyFromDomain(
    hostname: string
): Promise<AgencyFromDomain | null> {
    try {
        const supabase = createServiceClient();
        const cleanHost = hostname.toLowerCase().split(':')[0]; // Strip port

        // First, check if this is a custom domain
        if (!isPlatformDomain(cleanHost)) {
            const { data: agencyByDomain } = await supabase
                .from('agencies')
                .select('id, name, slug, branding, domain_verified')
                .eq('custom_domain', cleanHost)
                .single();

            if (agencyByDomain) {
                return {
                    ...agencyByDomain,
                    branding: agencyByDomain.branding as AgencyBranding | undefined,
                    matchType: 'custom_domain',
                };
            }
        }

        // Check for subdomain match
        const subdomain = getSubdomain(cleanHost);
        if (subdomain) {
            const { data: agencyBySlug } = await supabase
                .from('agencies')
                .select('id, name, slug, branding, domain_verified')
                .eq('slug', subdomain.toLowerCase())
                .single();

            if (agencyBySlug) {
                return {
                    ...agencyBySlug,
                    branding: agencyBySlug.branding as AgencyBranding | undefined,
                    matchType: 'subdomain',
                };
            }
        }

        // No agency-specific domain found
        return null;
    } catch (error) {
        console.error('Error fetching agency from domain:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Cached version — revalidates every 5 minutes.
 * The cache key is derived from the hostname argument.
 */
const getCachedAgency = unstable_cache(
    lookupAgencyFromDomain,
    ['agency-domain'],
    { revalidate: 300 }
);

/**
 * Get agency information from a domain/hostname.
 * Results are cached for 5 minutes to reduce DB load.
 *
 * @param hostname - The full hostname (e.g., "agency.example.com" or "dashboard.client.com")
 * @returns Agency info if found, null otherwise
 */
export async function getAgencyFromDomain(
    hostname: string
): Promise<AgencyFromDomain | null> {
    const cleanHost = hostname.toLowerCase().split(':')[0];
    return getCachedAgency(cleanHost);
}

/**
 * Validate if a domain can be used as a custom domain
 */
export function isValidCustomDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domainRegex.test(domain)) {
        return false;
    }

    // Cannot use platform domains
    if (isPlatformDomain(domain)) {
        return false;
    }

    return true;
}
