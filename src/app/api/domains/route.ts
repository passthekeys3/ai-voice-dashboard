import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { isValidCustomDomain } from '@/lib/getAgencyFromDomain';
import { addDomainToVercel, removeDomainFromVercel, getDomainFromVercel, isVercelConfigured } from '@/lib/vercel-domains';
import crypto from 'crypto';
import { safeParseJson } from '@/lib/validation';
import { withErrorHandling } from '@/lib/api/response';

// GET /api/domains - Get current domain configuration
export const GET = withErrorHandling(async () => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can manage domains
        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ---- Tier gate: Custom domains require Growth+ ----
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'white_label', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        const supabase = await createClient();

        const { data: agency, error } = await supabase
            .from('agencies')
            .select('custom_domain, domain_verified, domain_verification_token, domain_verified_at, slug')
            .eq('id', user.agency.id)
            .single();

        if (error) {
            console.error('Error fetching domain config:', error.code);
            return NextResponse.json({ error: 'Failed to fetch domain configuration' }, { status: 500 });
        }

        // Optionally check Vercel status for the domain
        let vercel_domain_status: { configured: boolean; verified: boolean } | null = null;
        if (agency.custom_domain && isVercelConfigured()) {
            const vercelResult = await getDomainFromVercel(agency.custom_domain);
            if (vercelResult.success) {
                vercel_domain_status = {
                    configured: vercelResult.domain.configured ?? false,
                    verified: vercelResult.domain.verified,
                };
            }
        }

        return NextResponse.json({
            data: {
                custom_domain: agency.custom_domain,
                domain_verified: agency.domain_verified,
                domain_verified_at: agency.domain_verified_at,
                verification_token: agency.domain_verification_token,
                slug: agency.slug,
                vercel_configured: isVercelConfigured(),
                vercel_domain_status,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/domains:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// POST /api/domains - Add or update custom domain
export const POST = withErrorHandling(async (request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can manage domains
        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ---- Tier gate: Custom domains require Growth+ ----
        const postTierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'white_label', user.agency.beta_ends_at);
        if (postTierError) {
            return NextResponse.json({ error: postTierError }, { status: 403 });
        }

        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const { custom_domain, slug } = bodyOrError;

        const supabase = await createClient();

        // Validate and update custom domain if provided
        if (custom_domain !== undefined) {
            if (custom_domain && !isValidCustomDomain(custom_domain)) {
                return NextResponse.json(
                    { error: 'Invalid domain format. Use a valid domain like "dashboard.yourcompany.com"' },
                    { status: 400 }
                );
            }

            // Check if domain is already in use by another agency
            if (custom_domain) {
                const { data: existingAgency } = await supabase
                    .from('agencies')
                    .select('id')
                    .eq('custom_domain', custom_domain.toLowerCase())
                    .neq('id', user.agency.id)
                    .single();

                if (existingAgency) {
                    return NextResponse.json(
                        { error: 'This domain is already in use by another agency' },
                        { status: 409 }
                    );
                }
            }

            // Generate a new verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');

            const { error: updateError } = await supabase
                .from('agencies')
                .update({
                    custom_domain: custom_domain ? custom_domain.toLowerCase() : null,
                    domain_verified: false,
                    domain_verification_token: custom_domain ? verificationToken : null,
                    domain_verified_at: null,
                })
                .eq('id', user.agency.id);

            if (updateError) {
                console.error('Error updating custom domain:', updateError.code);
                return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 });
            }

            // Automatically add the domain to Vercel project (non-blocking — DB is source of truth)
            let vercelStatus: string | undefined;
            if (custom_domain && isVercelConfigured()) {
                const vercelResult = await addDomainToVercel(custom_domain.toLowerCase());
                if (vercelResult.success) {
                    console.info(`[domains] Added ${custom_domain} to Vercel project`);
                    vercelStatus = 'added';
                } else {
                    console.warn(`[domains] Vercel add failed for ${custom_domain}: ${vercelResult.error}`);
                    // Return generic message to avoid leaking Vercel infrastructure details
                    vercelStatus = 'warning: domain could not be added to hosting provider';
                }
            }

            return NextResponse.json({
                data: {
                    custom_domain: custom_domain ? custom_domain.toLowerCase() : null,
                    domain_verified: false,
                    verification_token: custom_domain ? verificationToken : null,
                    vercel_status: vercelStatus,
                },
                message: custom_domain
                    ? 'Domain added. Please verify ownership by adding DNS records.'
                    : 'Custom domain removed.',
            });
        }

        // Validate and update slug if provided
        if (slug !== undefined) {
            // Validate slug format (lowercase alphanumeric with hyphens)
            const slugRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
            if (slug && !slugRegex.test(slug)) {
                return NextResponse.json(
                    { error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens (3-63 characters).' },
                    { status: 400 }
                );
            }

            // Check if slug is already in use by another agency
            if (slug) {
                const { data: existingAgency } = await supabase
                    .from('agencies')
                    .select('id')
                    .eq('slug', slug.toLowerCase())
                    .neq('id', user.agency.id)
                    .single();

                if (existingAgency) {
                    return NextResponse.json(
                        { error: 'This slug is already in use by another agency' },
                        { status: 409 }
                    );
                }
            }

            const { error: updateError } = await supabase
                .from('agencies')
                .update({ slug: slug ? slug.toLowerCase() : null })
                .eq('id', user.agency.id);

            if (updateError) {
                console.error('Error updating slug:', updateError.code);
                return NextResponse.json({ error: 'Failed to update slug' }, { status: 500 });
            }

            return NextResponse.json({
                data: { slug: slug ? slug.toLowerCase() : null },
                message: slug ? 'Subdomain slug updated.' : 'Subdomain slug removed.',
            });
        }

        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    } catch (error) {
        console.error('Error in POST /api/domains:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// DELETE /api/domains - Remove custom domain
// Intentionally NOT tier-gated: allow users who downgrade to remove
// their custom domain rather than stranding them.
export const DELETE = withErrorHandling(async () => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can manage domains
        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();

        // Fetch current domain before clearing it (needed for Vercel cleanup)
        const { data: currentAgency } = await supabase
            .from('agencies')
            .select('custom_domain')
            .eq('id', user.agency.id)
            .single();

        const { error } = await supabase
            .from('agencies')
            .update({
                custom_domain: null,
                domain_verified: false,
                domain_verification_token: null,
                domain_verified_at: null,
            })
            .eq('id', user.agency.id);

        if (error) {
            console.error('Error removing custom domain:', error.code);
            return NextResponse.json({ error: 'Failed to remove domain' }, { status: 500 });
        }

        // Remove domain from Vercel project
        if (currentAgency?.custom_domain && isVercelConfigured()) {
            const vercelResult = await removeDomainFromVercel(currentAgency.custom_domain);
            if (vercelResult.success) {
                console.info(`[domains] Removed ${currentAgency.custom_domain} from Vercel project`);
            } else {
                console.warn(`[domains] Vercel remove failed for ${currentAgency.custom_domain}: ${vercelResult.error}`);
            }
        }

        return NextResponse.json({
            message: 'Custom domain removed successfully.',
        });
    } catch (error) {
        console.error('Error in DELETE /api/domains:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
