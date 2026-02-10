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

// POST /api/billing/portal - Create Stripe customer portal session
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only agency admins can access billing portal
        if (!['agency_admin'].includes(user.profile.role)) {
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
        let returnUrl = `${appUrl}/settings`;
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
        console.error('Error creating billing portal session:', error);
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json({ error: 'Payment processing error' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/billing/portal - Get billing and subscription info
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                subscription_cancel_at_period_end
            `)
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Get current month date range for usage stats
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Get agents for this agency
        const { data: agents } = await supabase
            .from('agents')
            .select('id')
            .eq('agency_id', user.agency.id);

        const agentIds = agents?.map(a => a.id) || [];

        let usageData = {
            period_start: startOfMonth.toISOString(),
            period_end: endOfMonth.toISOString(),
            total_calls: 0,
            total_minutes: 0,
            total_cost: 0,
        };

        if (agentIds.length > 0) {
            // Get calls for the current month
            const { data: calls } = await supabase
                .from('calls')
                .select('duration_seconds, cost_cents')
                .in('agent_id', agentIds)
                .gte('started_at', startOfMonth.toISOString())
                .lte('started_at', endOfMonth.toISOString());

            const totalCalls = calls?.length || 0;
            const totalSeconds = calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;
            const totalMinutes = Math.round(totalSeconds / 60 * 100) / 100;
            const totalCostCents = calls?.reduce((sum, c) => sum + (c.cost_cents || 0), 0) || 0;
            const totalCost = totalCostCents / 100;

            usageData = {
                period_start: startOfMonth.toISOString(),
                period_end: endOfMonth.toISOString(),
                total_calls: totalCalls,
                total_minutes: totalMinutes,
                total_cost: Math.round(totalCost * 100) / 100,
            };
        }

        return NextResponse.json({
            data: {
                subscription: {
                    status: agency.subscription_status,
                    subscription_id: agency.subscription_id,
                    price_id: agency.subscription_price_id,
                    current_period_start: agency.subscription_current_period_start,
                    current_period_end: agency.subscription_current_period_end,
                    cancel_at_period_end: agency.subscription_cancel_at_period_end,
                },
                has_payment_method: !!agency.stripe_customer_id,
                usage: usageData,
            },
        });
    } catch (error) {
        console.error('Error fetching billing info:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
