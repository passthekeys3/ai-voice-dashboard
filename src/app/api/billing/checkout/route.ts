import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-01-28.clover',
    });
}

// POST /api/billing/checkout - Create Stripe checkout session for subscription
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can manage billing
        if (!['agency_admin'].includes(user.profile.role)) {
            return NextResponse.json({ error: 'Only agency admins can manage billing' }, { status: 403 });
        }

        const priceId = process.env.STRIPE_PRICE_ID;
        if (!priceId) {
            return NextResponse.json({ error: 'STRIPE_PRICE_ID not configured' }, { status: 500 });
        }

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

        // If already has active subscription, redirect to portal instead
        if (agency.subscription_status === 'active' || agency.subscription_status === 'trialing') {
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
            await supabase
                .from('agencies')
                .update({ stripe_customer_id: customerId })
                .eq('id', agency.id);
        }

        // Get the return URL from the request body or use default
        const body = await request.json().catch(() => ({}));
        let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings`;

        // Validate return_url is a relative path or same-origin URL to prevent open redirect
        if (body.return_url) {
            try {
                const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
                const candidate = new URL(body.return_url, appUrl.origin);
                if (candidate.origin === appUrl.origin) {
                    returnUrl = candidate.toString();
                }
            } catch {
                // Invalid URL — use default
            }
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}?checkout=canceled`,
            subscription_data: {
                metadata: {
                    agency_id: agency.id,
                },
            },
            metadata: {
                agency_id: agency.id,
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
        });

        return NextResponse.json({
            url: session.url,
            session_id: session.id,
        });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/billing/checkout - Get checkout session status
export async function GET(request: NextRequest) {
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
        console.error('Error retrieving checkout session:', error);
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
