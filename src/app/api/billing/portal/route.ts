import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isBillingAdmin } from '@/lib/auth';
import { getTierFromPriceId, getTierDefinition, getPerMinuteRate } from '@/lib/billing/tiers';
import { getStripe } from '@/lib/stripe';
import { withErrorHandling } from '@/lib/api/response';

// POST /api/billing/portal - Create Stripe customer portal session
export const POST = withErrorHandling(async (request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can access billing portal
        if (!isBillingAdmin(user)) {
            return NextResponse.json({ error: 'Only agency admins can access billing' }, { status: 403 });
        }

        const supabase = createServiceClient();

        // Get agency with Stripe customer ID
        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_customer_id, name')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.stripe_customer_id) {
            return NextResponse.json({
                error: 'No billing account configured',
                message: 'Please subscribe to a plan first.'
            }, { status: 400 });
        }

        const stripe = getStripe();

        // Get return URL from request body or use default
        const body = await request.json().catch(() => ({}));
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        let returnUrl = `${appUrl}/billing`;
        if (body.return_url && typeof body.return_url === 'string') {
            try {
                const parsed = new URL(body.return_url);
                const appOrigin = new URL(appUrl);
                if (parsed.origin === appOrigin.origin) {
                    returnUrl = body.return_url;
                }
            } catch {
                // Invalid URL, use default
            }
        }

        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: agency.stripe_customer_id,
            return_url: returnUrl,
        });

        return NextResponse.json({
            url: session.url,
        });
    } catch (error) {
        console.error('Error creating billing portal session:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// GET /api/billing/portal - Get billing and subscription info
export const GET = withErrorHandling(async (_request: NextRequest) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can view billing details
        if (!isBillingAdmin(user)) {
            return NextResponse.json({ error: 'Only agency admins can access billing' }, { status: 403 });
        }

        const supabase = createServiceClient();

        // Get agency subscription info
        const { data: agency } = await supabase
            .from('agencies')
            .select(`
                id,
                name,
                stripe_customer_id,
                subscription_id,
                subscription_status,
                subscription_price_id,
                subscription_current_period_start,
                subscription_current_period_end,
                subscription_cancel_at_period_end,
                plan_type,
                is_beta,
                beta_ends_at
            `)
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Use billing period dates when available, fall back to calendar month
        const now = new Date();
        const periodStart = agency.subscription_current_period_start
            ? new Date(agency.subscription_current_period_start)
            : new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = agency.subscription_current_period_end
            ? new Date(agency.subscription_current_period_end)
            : new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Get agents for this agency
        const { data: agents } = await supabase
            .from('agents')
            .select('id')
            .eq('agency_id', user.agency.id);

        const agentIds = agents?.map(a => a.id) || [];

        let usageData = {
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            total_calls: 0,
            total_minutes: 0,
            total_cost: 0,
        };

        if (agentIds.length > 0) {
            // Get calls for the current billing period
            const { data: calls } = await supabase
                .from('calls')
                .select('duration_seconds, cost_cents')
                .in('agent_id', agentIds)
                .gte('started_at', periodStart.toISOString())
                .lte('started_at', periodEnd.toISOString());

            const totalCalls = calls?.length || 0;
            const totalSeconds = calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;
            const totalMinutes = Math.round(totalSeconds / 60 * 100) / 100;
            const totalCostCents = calls?.reduce((sum, c) => sum + (c.cost_cents || 0), 0) || 0;
            const totalCost = totalCostCents / 100;

            usageData = {
                period_start: periodStart.toISOString(),
                period_end: periodEnd.toISOString(),
                total_calls: totalCalls,
                total_minutes: totalMinutes,
                total_cost: Math.round(totalCost * 100) / 100,
            };
        }

        const tierInfo = getTierFromPriceId(agency.subscription_price_id || '');
        const agencyPlanType = tierInfo?.planType || (agency.plan_type as 'self_service' | 'managed') || 'self_service';
        const tierDef = tierInfo ? getTierDefinition(tierInfo.tier, agencyPlanType) : null;

        return NextResponse.json({
            data: {
                subscription: {
                    status: agency.subscription_status,
                    subscription_id: agency.subscription_id,
                    price_id: agency.subscription_price_id,
                    current_period_start: agency.subscription_current_period_start,
                    current_period_end: agency.subscription_current_period_end,
                    cancel_at_period_end: agency.subscription_cancel_at_period_end,
                    plan_tier: tierInfo?.tier || null,
                    plan_type: agencyPlanType,
                    plan_name: tierDef?.name || null,
                    limits: tierDef?.limits || null,
                    per_minute_rate: getPerMinuteRate(),
                    is_beta: agency.is_beta || false,
                    beta_ends_at: agency.beta_ends_at || null,
                },
                has_payment_method: !!agency.stripe_customer_id,
                usage: usageData,
            },
        });
    } catch (error) {
        console.error('Error fetching billing info:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
