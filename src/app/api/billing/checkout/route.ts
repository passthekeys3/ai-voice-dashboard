import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isBillingAdmin } from '@/lib/auth';
import { getTierDefinition, getPriceId, getMeteredPriceId, type PlanTier, type BillingInterval } from '@/lib/billing/tiers';
import type { PlanType } from '@/types/database';
import { getStripe } from '@/lib/stripe';
import { withErrorHandling } from '@/lib/api/response';

const VALID_TIERS: PlanTier[] = ['starter', 'growth', 'agency'];
const VALID_PLAN_TYPES: PlanType[] = ['self_service', 'managed'];

// POST /api/billing/checkout - Create Stripe checkout session for subscription
export const POST = withErrorHandling(async (request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency owners can manage billing (intentionally excludes agency_member)
        if (!isBillingAdmin(user)) {
            return NextResponse.json({ error: 'Only agency admins can manage billing' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { tier, interval, return_url } = body;
        const planType: PlanType = VALID_PLAN_TYPES.includes(body.planType) ? body.planType : 'self_service';
        const billingInterval: BillingInterval = interval === 'yearly' ? 'yearly' : 'monthly';

        // Resolve base price ID from tier + planType + interval
        let basePriceId: string | undefined;
        let planTier: string = 'unknown';

        if (tier && VALID_TIERS.includes(tier)) {
            const tierDef = getTierDefinition(tier, planType);
            if (!tierDef) {
                return NextResponse.json({ error: `Tier "${tier}" (${planType}) is not configured` }, { status: 400 });
            }
            const resolvedPrice = getPriceId(tier, planType, billingInterval);
            if (!resolvedPrice && billingInterval === 'yearly') {
                return NextResponse.json({ error: 'Yearly pricing is not yet available for this plan. Please choose monthly billing.' }, { status: 400 });
            }
            basePriceId = resolvedPrice || tierDef.priceId;
            planTier = tier;
        } else {
            // Backward compat: fall back to legacy STRIPE_PRICE_ID
            basePriceId = process.env.STRIPE_PRICE_ID;
        }

        if (!basePriceId) {
            return NextResponse.json({ error: 'No pricing configured. Please select a plan.' }, { status: 400 });
        }

        // Get metered price for per-minute billing
        const meteredPriceId = getMeteredPriceId();

        const stripe = getStripe();
        const supabase = createServiceClient();

        // Check if agency already has an active subscription
        const { data: agency } = await supabase
            .from('agencies')
            .select('id, name, stripe_customer_id, subscription_status, subscription_id')
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // If already has a real Stripe subscription, redirect to portal instead.
        // Allow beta trial users (trialing with no subscription_id) to check out.
        const hasRealSubscription = agency.subscription_id &&
            (agency.subscription_status === 'active' || agency.subscription_status === 'trialing');
        if (hasRealSubscription) {
            return NextResponse.json({
                error: 'Agency already has an active subscription',
                message: 'Use the billing portal to manage your subscription',
            }, { status: 400 });
        }

        let customerId = agency.stripe_customer_id;

        // Create or retrieve Stripe customer
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: agency.name,
                metadata: {
                    agency_id: agency.id,
                },
            });
            customerId = customer.id;

            // Store customer ID in database
            const { error: updateError } = await supabase
                .from('agencies')
                .update({ stripe_customer_id: customerId })
                .eq('id', agency.id);

            if (updateError) {
                console.error('Failed to store Stripe customer ID:', updateError);
                return NextResponse.json(
                    { error: 'Failed to initialize billing. Please try again.' },
                    { status: 500 }
                );
            }
        }

        // Resolve return URL
        let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing`;

        // Validate return_url is a relative path or same-origin URL to prevent open redirect
        if (return_url) {
            try {
                const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
                const candidate = new URL(return_url, appUrl.origin);
                if (candidate.origin === appUrl.origin) {
                    returnUrl = candidate.toString();
                }
            } catch {
                // Invalid URL — use default
            }
        }

        // Build line items: base price + optional metered price
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            { price: basePriceId, quantity: 1 },
        ];

        // Add metered line item for per-minute billing (always included — 0 usage = $0 charge)
        if (meteredPriceId) {
            lineItems.push({ price: meteredPriceId });
        } else {
            console.warn('[CHECKOUT] STRIPE_PRICE_METERED_MINUTE not configured — subscription will lack per-minute billing');
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: lineItems,
            success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}?checkout=canceled`,
            subscription_data: {
                metadata: {
                    agency_id: agency.id,
                    plan_tier: planTier,
                    plan_type: planType,
                    billing_interval: billingInterval,
                },
            },
            metadata: {
                agency_id: agency.id,
                plan_tier: planTier,
                plan_type: planType,
                billing_interval: billingInterval,
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
        });

        return NextResponse.json({
            url: session.url,
            session_id: session.id,
        });
    } catch (error) {
        console.error('Error creating checkout session:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// GET /api/billing/checkout - Get checkout session status
export const GET = withErrorHandling(async (request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription'],
        });

        // Verify the session belongs to this agency's customer
        const supabase = createServiceClient();
        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_customer_id')
            .eq('id', user.agency.id)
            .single();

        if (session.customer !== agency?.stripe_customer_id) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: session.status,
            payment_status: session.payment_status,
            subscription_id: typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id,
        });
    } catch (error) {
        console.error('Error retrieving checkout session:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
