import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    databaseError,
    apiSuccess,
    badRequest,
    withErrorHandling,
} from '@/lib/api/response';
import { VALID_BILLING_TYPES } from '@/lib/constants/config';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-01-28.clover',
    });
}

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id } = await context!.params;
    const supabase = await createClient();

    const { data: client, error } = await supabase
        .from('clients')
        .select('id, billing_type, billing_amount_cents, stripe_subscription_id, next_billing_date, ai_call_analysis')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (error || !client) {
        return notFound('Client');
    }

    return apiSuccess(client);
});

export const PATCH = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id } = await context!.params;
    const body = await request.json();
    const { billing_type, billing_amount_cents, ai_call_analysis } = body;

    // Validate billing_type
    if (billing_type !== null && billing_type !== undefined) {
        if (!VALID_BILLING_TYPES.includes(billing_type)) {
            return badRequest(`Invalid billing type. Must be one of: ${VALID_BILLING_TYPES.join(', ')}`);
        }
    }

    // Validate billing_amount_cents
    if (billing_amount_cents !== null && billing_amount_cents !== undefined) {
        if (typeof billing_amount_cents !== 'number' || billing_amount_cents < 0) {
            return badRequest('Billing amount must be a non-negative number');
        }
    }

    // If billing_type is set, require billing_amount_cents
    if (billing_type && (billing_amount_cents === null || billing_amount_cents === undefined)) {
        return badRequest('Billing amount is required when billing type is set');
    }

    const supabase = await createClient();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (billing_type === null) {
        // Clear all billing fields
        updateData.billing_type = null;
        updateData.billing_amount_cents = null;
        // Note: We don't clear stripe_subscription_id or next_billing_date here
        // as those should be managed by the Stripe integration
    } else if (billing_type !== undefined) {
        updateData.billing_type = billing_type;
        updateData.billing_amount_cents = billing_amount_cents;
    }

    // Only update billing_amount_cents if billing_type is already set and amount is provided
    if (billing_type === undefined && billing_amount_cents !== undefined) {
        updateData.billing_amount_cents = billing_amount_cents;
    }

    // AI Call Analysis toggle (independent of billing type)
    if (ai_call_analysis !== undefined) {
        updateData.ai_call_analysis = !!ai_call_analysis;
    }

    const { data: client, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .select('id, name, billing_type, billing_amount_cents, stripe_subscription_id, stripe_customer_id, next_billing_date, ai_call_analysis')
        .single();

    if (error) {
        return databaseError(error);
    }

    if (!client) {
        return notFound('Client');
    }

    // Auto-create Stripe Customer on agency's Connect account if billing_type is set
    if (client.billing_type && !client.stripe_customer_id) {
        try {
            const serviceClient = createServiceClient();
            const { data: agency } = await serviceClient
                .from('agencies')
                .select('stripe_connect_account_id, stripe_connect_charges_enabled')
                .eq('id', user.agency.id)
                .single();

            if (agency?.stripe_connect_account_id && agency.stripe_connect_charges_enabled) {
                const stripe = getStripe();
                const customer = await stripe.customers.create(
                    {
                        name: client.name,
                        metadata: { client_id: client.id, agency_id: user.agency.id },
                    },
                    { stripeAccount: agency.stripe_connect_account_id }
                );

                // Store customer ID on client
                await supabase
                    .from('clients')
                    .update({ stripe_customer_id: customer.id })
                    .eq('id', client.id);

                // Return updated data
                return apiSuccess({ ...client, stripe_customer_id: customer.id });
            }
        } catch (err) {
            // Don't fail the billing update if Stripe Customer creation fails
            console.error('Auto-create Stripe Customer failed:', err instanceof Error ? err.message : 'Unknown error');
        }
    }

    return apiSuccess(client);
});
