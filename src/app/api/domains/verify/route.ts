import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { verifyDomainOnVercel, isVercelConfigured } from '@/lib/vercel-domains';
import dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);

// The hostname that custom domains should point to
const PLATFORM_HOSTNAME = process.env.PLATFORM_HOSTNAME || 'buildvoiceai.com';

interface VerificationResult {
    dns_configured: boolean;
    txt_record_found: boolean;
    cname_configured: boolean;
    errors: string[];
}

async function verifyDomain(domain: string, verificationToken: string): Promise<VerificationResult> {
    const result: VerificationResult = {
        dns_configured: false,
        txt_record_found: false,
        cname_configured: false,
        errors: [],
    };

    // Check for TXT record verification
    const txtRecordName = `_buildvoiceai-verify.${domain}`;
    try {
        const txtRecords = await resolveTxt(txtRecordName);
        const flatRecords = txtRecords.flat();
        result.txt_record_found = flatRecords.some(record =>
            record.includes(verificationToken)
        );

        if (!result.txt_record_found) {
            result.errors.push('TXT record verification failed. Please check the record value matches exactly.');
        }
    } catch (error) {
        const dnsError = error as NodeJS.ErrnoException;
        if (dnsError.code === 'ENOTFOUND' || dnsError.code === 'ENODATA') {
            result.errors.push(`TXT record "${txtRecordName}" not found`);
        } else {
            result.errors.push(`Error checking TXT record: ${dnsError.message}`);
        }
    }

    // Check for CNAME record pointing to platform
    try {
        const cnameRecords = await resolveCname(domain);
        const platformHost = PLATFORM_HOSTNAME.toLowerCase();
        result.cname_configured = cnameRecords.some(record => {
            const r = record.toLowerCase().replace(/\.$/, ''); // Remove trailing dot
            return r === platformHost ||
                r.endsWith('.' + platformHost) ||
                r.endsWith('.vercel.app') ||
                r.endsWith('.vercel-dns.com');
        });

        if (!result.cname_configured) {
            result.errors.push(`CNAME record should point to ${PLATFORM_HOSTNAME}`);
        }
    } catch (error) {
        const dnsError = error as NodeJS.ErrnoException;
        if (dnsError.code === 'ENOTFOUND' || dnsError.code === 'ENODATA') {
            result.errors.push(`CNAME record for "${domain}" not found. Add a CNAME pointing to ${PLATFORM_HOSTNAME}`);
        } else {
            result.errors.push(`Error checking CNAME record: ${dnsError.message}`);
        }
    }

    // Domain is configured if TXT verification passes and CNAME is set up
    result.dns_configured = result.txt_record_found && result.cname_configured;

    return result;
}

// POST /api/domains/verify - Verify domain DNS configuration
export async function POST() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can verify domains
        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();

        // Get current domain configuration
        const { data: agency, error: fetchError } = await supabase
            .from('agencies')
            .select('custom_domain, domain_verification_token, domain_verified')
            .eq('id', user.agency.id)
            .single();

        if (fetchError) {
            console.error('Error fetching agency:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 });
        }

        if (!agency.custom_domain) {
            return NextResponse.json(
                { error: 'No custom domain configured' },
                { status: 400 }
            );
        }

        if (!agency.domain_verification_token) {
            return NextResponse.json(
                { error: 'No verification token found. Please re-add the domain.' },
                { status: 400 }
            );
        }

        // Already verified
        if (agency.domain_verified) {
            return NextResponse.json({
                data: {
                    verified: true,
                    message: 'Domain is already verified',
                },
            });
        }

        // Verify DNS configuration
        const verificationResult = await verifyDomain(
            agency.custom_domain,
            agency.domain_verification_token
        );

        if (verificationResult.dns_configured) {
            // Update database to mark domain as verified
            const { error: updateError } = await supabase
                .from('agencies')
                .update({
                    domain_verified: true,
                    domain_verified_at: new Date().toISOString(),
                })
                .eq('id', user.agency.id);

            if (updateError) {
                console.error('Error updating verification status:', updateError);
                return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
            }

            // Also trigger Vercel's domain verification for SSL provisioning
            let vercel_verified = false;
            if (isVercelConfigured()) {
                const vercelResult = await verifyDomainOnVercel(agency.custom_domain);
                vercel_verified = vercelResult.success && vercelResult.domain.verified;
                if (!vercel_verified) {
                    console.warn(`[domains] Vercel verification pending for ${agency.custom_domain}:`,
                        vercelResult.success ? 'not yet verified by Vercel' : vercelResult.error);
                }
            }

            return NextResponse.json({
                data: {
                    verified: true,
                    message: 'Domain verified successfully! Your custom domain is now active.',
                    verification_result: verificationResult,
                    vercel_verified,
                },
            });
        }

        // Verification failed
        return NextResponse.json({
            data: {
                verified: false,
                message: 'Domain verification failed. Please check your DNS configuration.',
                verification_result: verificationResult,
                instructions: {
                    txt_record: {
                        name: `_buildvoiceai-verify.${agency.custom_domain}`,
                        type: 'TXT',
                        value: agency.domain_verification_token,
                    },
                    cname_record: {
                        name: agency.custom_domain,
                        type: 'CNAME',
                        value: PLATFORM_HOSTNAME,
                    },
                },
            },
        });
    } catch (error) {
        console.error('Error in POST /api/domains/verify:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/domains/verify - Get verification status and instructions
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can check verification status
        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();

        const { data: agency, error } = await supabase
            .from('agencies')
            .select('custom_domain, domain_verification_token, domain_verified, domain_verified_at')
            .eq('id', user.agency.id)
            .single();

        if (error) {
            console.error('Error fetching agency:', error);
            return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 });
        }

        if (!agency.custom_domain) {
            return NextResponse.json({
                data: {
                    has_domain: false,
                    message: 'No custom domain configured',
                },
            });
        }

        return NextResponse.json({
            data: {
                has_domain: true,
                custom_domain: agency.custom_domain,
                verified: agency.domain_verified,
                verified_at: agency.domain_verified_at,
                instructions: !agency.domain_verified ? {
                    txt_record: {
                        name: `_buildvoiceai-verify.${agency.custom_domain}`,
                        type: 'TXT',
                        value: agency.domain_verification_token,
                        description: 'Add this TXT record to verify domain ownership',
                    },
                    cname_record: {
                        name: agency.custom_domain,
                        type: 'CNAME',
                        value: PLATFORM_HOSTNAME,
                        description: 'Add this CNAME record to point your domain to our platform',
                    },
                } : null,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/domains/verify:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
