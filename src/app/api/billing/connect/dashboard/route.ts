import { NextResponse } from 'next/server';
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
        console.error('Stripe Connect dashboard link error:', error);
        return NextResponse.json({ error: 'Failed to generate dashboard link' }, { status: 500 });
    }
}
