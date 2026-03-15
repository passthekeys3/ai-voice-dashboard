import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/billing/connect/dashboard — Generate Express Dashboard login link
 *
 * Returns a URL that redirects the agency to their Stripe Express Dashboard
 * where they can view payouts, balances, tax documents, etc.
 */
export async function POST() {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ---- Tier gate: Stripe Connect requires Growth+ ----
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'stripe_connect', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_connect_account_id, stripe_connect_onboarding_complete')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.stripe_connect_account_id) {
            return NextResponse.json({ error: 'No Stripe Connect account found' }, { status: 400 });
        }

        if (!agency.stripe_connect_onboarding_complete) {
            return NextResponse.json({ error: 'Stripe onboarding not complete' }, { status: 400 });
        }

        const stripe = getStripe();
        const loginLink = await stripe.accounts.createLoginLink(agency.stripe_connect_account_id);

        return NextResponse.json({ url: loginLink.url });
    } catch (error) {
        console.error('Stripe Connect dashboard link error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Failed to generate dashboard link' }, { status: 500 });
    }
}
