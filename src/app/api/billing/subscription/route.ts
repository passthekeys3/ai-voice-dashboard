import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isBillingAdmin } from '@/lib/auth';
import { getTierFromPriceId, getTierDefinition, getPriceId, getMeteredPriceId, getPerMinuteRate, type PlanTier, type BillingInterval } from '@/lib/billing/tiers';
import type { PlanType } from '@/types/database';
import { getStripe } from '@/lib/stripe';

// GET /api/billing/subscription - Get current subscription details
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isBillingAdmin(user)) {
            return NextResponse.json({ error: 'Only agency admins can view subscription' }, { status: 403 });
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
                subscription_cancel_at_period_end,
                plan_type
            `)
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        const agencyPlanType = (agency.plan_type as PlanType) || 'self_service';

        if (agency.subscription_id) {
            try {
                const stripe = getStripe();
                const subscription = await stripe.subscriptions.retrieve(agency.subscription_id);

                const baseItem = subscription.items.data.find(item =>
                    !item.price.recurring || item.price.recurring.usage_type !== 'metered'
                ) || subscription.items.data[0];

                const tierInfo = getTierFromPriceId(baseItem?.price?.id || '');
                const tier = tierInfo?.tier || null;
                const planType = tierInfo?.planType || agencyPlanType;
                const tierDef = tier ? getTierDefinition(tier, planType) : null;

                return NextResponse.json({
                    data: {
                        id: subscription.id,
                        status: subscription.status,
                        price_id: baseItem?.price?.id,
                        current_period_start: baseItem?.current_period_start
                            ? new Date(baseItem.current_period_start * 1000).toISOString()
                            : null,
                        current_period_end: baseItem?.current_period_end
                            ? new Date(baseItem.current_period_end * 1000).toISOString()
                            : null,
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        canceled_at: subscription.canceled_at
                            ? new Date(subscription.canceled_at * 1000).toISOString()
                            : null,
                        plan_tier: tier,
                        plan_type: planType,
                        plan_name: tierDef?.name || null,
                        limits: tierDef?.limits || null,
                        per_minute_rate: getPerMinuteRate(),
                    },
                });
            } catch (stripeError) {
                console.warn('Could not fetch subscription from Stripe:', stripeError instanceof Error ? stripeError.message : 'Unknown error');
            }
        }

        const tierInfo = getTierFromPriceId(agency.subscription_price_id || '');
        const dbTier = tierInfo?.tier || null;
        const dbPlanType = tierInfo?.planType || agencyPlanType;
        const dbTierDef = dbTier ? getTierDefinition(dbTier, dbPlanType) : null;

        return NextResponse.json({
            data: {
                id: agency.subscription_id,
                status: agency.subscription_status,
                price_id: agency.subscription_price_id,
                current_period_start: agency.subscription_current_period_start,
                current_period_end: agency.subscription_current_period_end,
                cancel_at_period_end: agency.subscription_cancel_at_period_end,
                canceled_at: null,
                plan_tier: dbTier,
                plan_type: dbPlanType,
                plan_name: dbTierDef?.name || null,
                limits: dbTierDef?.limits || null,
                per_minute_rate: getPerMinuteRate(),
            },
        });
    } catch (error) {
        console.error('Error fetching subscription:', error instanceof Error ? error.message : 'Unknown error');
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

        if (!isBillingAdmin(user)) {
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

        const body = await request.json().catch(() => ({}));
        const cancelImmediately = body.immediately === true;

        if (cancelImmediately) {
            const subscription = await stripe.subscriptions.cancel(agency.subscription_id);
            return NextResponse.json({
                message: 'Subscription canceled immediately',
                status: subscription.status,
            });
        } else {
            const subscription = await stripe.subscriptions.update(agency.subscription_id, {
                cancel_at_period_end: true,
            });

            const baseItem = subscription.items.data.find(item =>
                !item.price.recurring || item.price.recurring.usage_type !== 'metered'
            ) || subscription.items.data[0];

            return NextResponse.json({
                message: 'Subscription will be canceled at the end of the billing period',
                cancel_at: baseItem?.current_period_end
                    ? new Date(baseItem.current_period_end * 1000).toISOString()
                    : null,
            });
        }
    } catch (error) {
        console.error('Error canceling subscription:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

const VALID_TIERS: PlanTier[] = ['starter', 'growth', 'agency'];
const VALID_PLAN_TYPES: PlanType[] = ['self_service', 'managed'];

// PATCH /api/billing/subscription - Resume canceled subscription or change plan tier
export async function PATCH(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isBillingAdmin(user)) {
            return NextResponse.json({ error: 'Only agency admins can manage subscription' }, { status: 403 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('subscription_id, plan_type')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.subscription_id) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
        }

        const stripe = getStripe();
        const body = await request.json().catch(() => ({}));

        if (body.tier && VALID_TIERS.includes(body.tier)) {
            const planType: PlanType = VALID_PLAN_TYPES.includes(body.planType)
                ? body.planType
                : (agency.plan_type as PlanType) || 'self_service';

            const tierDef = getTierDefinition(body.tier, planType);
            if (!tierDef) {
                return NextResponse.json({ error: `Tier "${body.tier}" (${planType}) is not configured` }, { status: 400 });
            }

            const billingInterval: BillingInterval = body.interval === 'yearly' ? 'yearly' : 'monthly';
            let newBasePriceId = getPriceId(body.tier, planType, billingInterval);
            if (!newBasePriceId && billingInterval === 'yearly') {
                return NextResponse.json({ error: 'Yearly pricing is not yet available for this plan. Please choose monthly billing.' }, { status: 400 });
            }
            newBasePriceId = newBasePriceId || tierDef.priceId;
            const newMeteredPriceId = getMeteredPriceId();

            const currentSub = await stripe.subscriptions.retrieve(agency.subscription_id);
            const currentBaseItem = currentSub.items.data.find(item =>
                !item.price.recurring || item.price.recurring.usage_type !== 'metered'
            ) || currentSub.items.data[0];
            const currentMeteredItem = currentSub.items.data.find(item =>
                item.price.recurring?.usage_type === 'metered'
            );

            if (!currentBaseItem) {
                return NextResponse.json({ error: 'Subscription has no items' }, { status: 400 });
            }

            const items: Stripe.SubscriptionUpdateParams.Item[] = [
                { id: currentBaseItem.id, price: newBasePriceId },
            ];
            if (currentMeteredItem && newMeteredPriceId) {
                items.push({ id: currentMeteredItem.id, price: newMeteredPriceId });
            } else if (!currentMeteredItem && newMeteredPriceId) {
                items.push({ price: newMeteredPriceId });
            }

            const subscription = await stripe.subscriptions.update(agency.subscription_id, {
                items,
                metadata: { plan_tier: body.tier, plan_type: planType, billing_interval: billingInterval },
                proration_behavior: 'create_prorations',
            });

            const updatedBaseItem = subscription.items.data.find(item =>
                !item.price.recurring || item.price.recurring.usage_type !== 'metered'
            ) || subscription.items.data[0];
            const tierInfo = getTierFromPriceId(updatedBaseItem?.price?.id || '');
            const newTierDef = tierInfo ? getTierDefinition(tierInfo.tier, tierInfo.planType) : null;

            return NextResponse.json({
                message: `Plan changed to ${newTierDef?.name || body.tier}`,
                status: subscription.status,
                plan_tier: tierInfo?.tier || null,
                plan_type: tierInfo?.planType || planType,
                plan_name: newTierDef?.name || null,
            });
        }

        const subscription = await stripe.subscriptions.update(agency.subscription_id, {
            cancel_at_period_end: false,
        });

        return NextResponse.json({
            message: 'Subscription resumed',
            status: subscription.status,
        });
    } catch (error) {
        console.error('Error updating subscription:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
