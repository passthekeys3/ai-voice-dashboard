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

// GET /api/billing/subscription - Get current subscription details
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select(`
                subscription_id,
                subscription_status,
                subscription_price_id,
                subscription_current_period_start,
                subscription_current_period_end,
                subscription_cancel_at_period_end
            `)
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // If there's a subscription ID, fetch latest from Stripe
        if (agency.subscription_id) {
            try {
                const stripe = getStripe();
                const subscription = await stripe.subscriptions.retrieve(agency.subscription_id);
                const firstItem = subscription.items.data[0];

                return NextResponse.json({
                    data: {
                        id: subscription.id,
                        status: subscription.status,
                        price_id: firstItem?.price?.id,
                        current_period_start: firstItem?.current_period_start
                            ? new Date(firstItem.current_period_start * 1000).toISOString()
                            : null,
                        current_period_end: firstItem?.current_period_end
                            ? new Date(firstItem.current_period_end * 1000).toISOString()
                            : null,
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        canceled_at: subscription.canceled_at
                            ? new Date(subscription.canceled_at * 1000).toISOString()
                            : null,
                    },
                });
            } catch (stripeError) {
                // If Stripe fails, return database data
                console.warn('Could not fetch subscription from Stripe:', stripeError);
            }
        }

        return NextResponse.json({
            data: {
                id: agency.subscription_id,
                status: agency.subscription_status,
                price_id: agency.subscription_price_id,
                current_period_start: agency.subscription_current_period_start,
                current_period_end: agency.subscription_current_period_end,
                cancel_at_period_end: agency.subscription_cancel_at_period_end,
                canceled_at: null,
            },
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/billing/subscription - Cancel subscription
export async function DELETE(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can cancel subscription
        if (!['agency_admin'].includes(user.profile.role)) {
            return NextResponse.json({ error: 'Only agency admins can cancel subscription' }, { status: 403 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('subscription_id')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.subscription_id) {
            return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
        }

        const stripe = getStripe();

        // Get body to check if immediate cancellation is requested
        const body = await request.json().catch(() => ({}));
        const cancelImmediately = body.immediately === true;

        if (cancelImmediately) {
            // Cancel immediately
            const subscription = await stripe.subscriptions.cancel(agency.subscription_id);
            return NextResponse.json({
                message: 'Subscription canceled immediately',
                status: subscription.status,
            });
        } else {
            // Cancel at period end (default)
            const subscription = await stripe.subscriptions.update(agency.subscription_id, {
                cancel_at_period_end: true,
            });

            const firstItem = subscription.items.data[0];

            return NextResponse.json({
                message: 'Subscription will be canceled at the end of the billing period',
                cancel_at: firstItem?.current_period_end
                    ? new Date(firstItem.current_period_end * 1000).toISOString()
                    : null,
            });
        }
    } catch (error) {
        console.error('Error canceling subscription:', error);
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/billing/subscription - Resume canceled subscription
export async function PATCH(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can manage subscription
        if (!['agency_admin'].includes(user.profile.role)) {
            return NextResponse.json({ error: 'Only agency admins can manage subscription' }, { status: 403 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('subscription_id')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.subscription_id) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
        }

        const stripe = getStripe();

        // Resume subscription by removing cancel_at_period_end
        const subscription = await stripe.subscriptions.update(agency.subscription_id, {
            cancel_at_period_end: false,
        });

        return NextResponse.json({
            message: 'Subscription resumed',
            status: subscription.status,
        });
    } catch (error) {
        console.error('Error resuming subscription:', error);
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
