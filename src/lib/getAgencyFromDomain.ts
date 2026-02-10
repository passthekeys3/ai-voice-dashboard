import { createServiceClient } from '@/lib/supabase/server';
import type { AgencyBranding } from '@/types';

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
    const domain = hostname.toLowerCase();
    return PLATFORM_DOMAINS.some(pd =>
        domain === pd || domain.endsWith(`.${pd}`)
    );
}

// Extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
    const parts = hostname.split('.');

    // Need at least 3 parts for a subdomain (sub.domain.tld)
    if (parts.length < 3) return null;

    // For localhost or IP, no subdomain
    if (hostname.includes('localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
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
 * Get agency information from a domain/hostname
 * Used by middleware and auth pages to apply correct branding
 *
 * @param hostname - The full hostname (e.g., "agency.example.com" or "dashboard.client.com")
 * @returns Agency info if found, null otherwise
 */
export async function getAgencyFromDomain(
    hostname: string
): Promise<AgencyFromDomain | null> {
    try {
        const supabase = createServiceClient();

        // First, check if this is a custom domain
        if (!isPlatformDomain(hostname)) {
            const { data: agencyByDomain } = await supabase
                .from('agencies')
                .select('id, name, slug, branding, domain_verified')
                .eq('custom_domain', hostname.toLowerCase())
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
        const subdomain = getSubdomain(hostname);
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
        console.error('Error fetching agency from domain:', error);
        return null;
    }
}

/**
 * Get agency branding for a hostname (cached-friendly version)
 * Returns just the branding info needed for rendering
 */
export async function getAgencyBrandingFromDomain(
    hostname: string
): Promise<AgencyBranding | null> {
    const agency = await getAgencyFromDomain(hostname);
    return agency?.branding || null;
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
