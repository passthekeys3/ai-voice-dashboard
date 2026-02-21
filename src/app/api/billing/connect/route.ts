import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-01-28.clover',
    });
}

/**
 * GET /api/billing/connect — Check Stripe Connect status
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();
        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, platform_fee_percent')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.stripe_connect_account_id) {
            return NextResponse.json({
                data: {
                    connected: false,
                    charges_enabled: false,
                    payouts_enabled: false,
                    details_submitted: false,
                    onboarding_complete: false,
                },
            });
        }

        // Fetch live status from Stripe
        const stripe = getStripe();
        try {
            const account = await stripe.accounts.retrieve(agency.stripe_connect_account_id);

            // Sync DB if stale
            const needsUpdate =
                agency.stripe_connect_charges_enabled !== account.charges_enabled ||
                agency.stripe_connect_payouts_enabled !== account.payouts_enabled ||
                agency.stripe_connect_onboarding_complete !== account.details_submitted;

            if (needsUpdate) {
                await supabase
                    .from('agencies')
                    .update({
                        stripe_connect_charges_enabled: account.charges_enabled,
                        stripe_connect_payouts_enabled: account.payouts_enabled,
                        stripe_connect_onboarding_complete: account.details_submitted,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', user.agency.id);
            }

            return NextResponse.json({
                data: {
                    connected: true,
                    account_id: account.id,
                    charges_enabled: account.charges_enabled,
                    payouts_enabled: account.payouts_enabled,
                    details_submitted: account.details_submitted,
                    onboarding_complete: account.details_submitted,
                    requirements: account.requirements?.currently_due?.length
                        ? { currently_due: account.requirements.currently_due.length }
                        : null,
                    platform_fee_percent: agency.platform_fee_percent || 0,
                },
            });
        } catch {
            // Account may have been deleted externally
            return NextResponse.json({
                data: {
                    connected: true,
                    account_id: agency.stripe_connect_account_id,
                    charges_enabled: false,
                    payouts_enabled: false,
                    details_submitted: false,
                    onboarding_complete: false,
                    error: 'Unable to verify account status',
                },
            });
        }
    } catch (error) {
        console.error('Stripe Connect status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/billing/connect — Create Express account + onboarding link
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));

        // Validate return_url to prevent open redirect attacks
        const appOrigin = process.env.NEXT_PUBLIC_APP_URL
            ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
            : null;
        let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings`;
        if (body.return_url && appOrigin) {
            try {
                const parsed = new URL(body.return_url);
                if (parsed.origin === appOrigin) {
                    returnUrl = body.return_url;
                }
            } catch {
                // Invalid URL — fall through to default
            }
        }

        const stripe = getStripe();
        const supabase = createServiceClient();

        // Check if agency already has a Connect account
        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_connect_account_id, name')
            .eq('id', user.agency.id)
            .single();

        let accountId = agency?.stripe_connect_account_id;

        // Create Express account if none exists
        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                metadata: {
                    agency_id: user.agency.id,
                },
                business_profile: {
                    name: agency?.name || undefined,
                },
            });

            accountId = account.id;

            // Store the account ID
            await supabase
                .from('agencies')
                .update({
                    stripe_connect_account_id: accountId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.agency.id);
        }

        // Generate onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            type: 'account_onboarding',
            return_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}stripe_connect=return`,
            refresh_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}stripe_connect=refresh`,
        });

        return NextResponse.json({ url: accountLink.url });
    } catch (error) {
        console.error('Stripe Connect onboarding error:', error);
        return NextResponse.json({ error: 'Failed to start Stripe Connect onboarding' }, { status: 500 });
    }
}

/**
 * PATCH /api/billing/connect — Update Connect settings (e.g. platform fee)
 */
export async function PATCH(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const { platform_fee_percent } = body;

        if (platform_fee_percent === undefined || platform_fee_percent === null) {
            return NextResponse.json({ error: 'platform_fee_percent is required' }, { status: 400 });
        }

        if (typeof platform_fee_percent !== 'number' || platform_fee_percent < 0 || platform_fee_percent > 50) {
            return NextResponse.json({ error: 'platform_fee_percent must be a number between 0 and 50' }, { status: 400 });
        }

        const supabase = createServiceClient();

        const { error } = await supabase
            .from('agencies')
            .update({
                platform_fee_percent,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.agency.id);

        if (error) {
            console.error('Failed to update platform fee:', error);
            return NextResponse.json({ error: 'Failed to update platform fee' }, { status: 500 });
        }

        return NextResponse.json({ success: true, platform_fee_percent });
    } catch (error) {
        console.error('Stripe Connect PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/billing/connect — Disconnect Stripe Connect account
 */
export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_connect_account_id')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.stripe_connect_account_id) {
            return NextResponse.json({ error: 'No Stripe Connect account to disconnect' }, { status: 400 });
        }

        // Delete the Express account from Stripe
        const stripe = getStripe();
        try {
            await stripe.accounts.del(agency.stripe_connect_account_id);
        } catch (err) {
            // Account may already be deleted — continue with cleanup
            console.warn('Failed to delete Stripe Connect account (may already be removed):', err);
        }

        // Clear Connect fields on agency
        await supabase
            .from('agencies')
            .update({
                stripe_connect_account_id: null,
                stripe_connect_onboarding_complete: false,
                stripe_connect_charges_enabled: false,
                stripe_connect_payouts_enabled: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.agency.id);

        // Clear stripe_customer_id on all clients (those customers were on the Connect account)
        await supabase
            .from('clients')
            .update({ stripe_customer_id: null })
            .eq('agency_id', user.agency.id)
            .not('stripe_customer_id', 'is', null);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Stripe Connect disconnect error:', error);
        return NextResponse.json({ error: 'Failed to disconnect Stripe account' }, { status: 500 });
    }
}
