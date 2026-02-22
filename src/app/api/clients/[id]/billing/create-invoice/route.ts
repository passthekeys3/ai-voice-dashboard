import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    badRequest,
    apiSuccess,
    externalServiceError,
    withErrorHandling,
} from '@/lib/api/response';

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

/**
 * POST /api/clients/[id]/billing/create-invoice
 *
 * Creates a one-time invoice for a client on the agency's Connect account.
 * Useful for one_time billing type clients or ad-hoc invoices.
 *
 * Body: { amount_cents?: number, description?: string }
 * - amount_cents defaults to client.billing_amount_cents
 * - description defaults to "AI Voice Agent Service"
 */
export const POST = withErrorHandling(async (
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
    const body = await request.json().catch(() => ({}));

    const supabase = createServiceClient();

    // Get client with agency Connect info
    const { data: client } = await supabase
        .from('clients')
        .select('id, name, stripe_customer_id, billing_amount_cents, billing_type, agency_id')
        .eq('id', id)
        .eq('agency_id', user.agency.id)
        .single();

    if (!client) {
        return notFound('Client');
    }

    if (!client.stripe_customer_id) {
        return badRequest('Client does not have a Stripe customer. Configure billing first.');
    }

    // Get agency Connect account
    const { data: agency } = await supabase
        .from('agencies')
        .select('stripe_connect_account_id, stripe_connect_charges_enabled, platform_fee_percent')
        .eq('id', user.agency.id)
        .single();

    if (!agency?.stripe_connect_account_id || !agency.stripe_connect_charges_enabled) {
        return badRequest('Stripe Connect is not set up or charges are not enabled.');
    }

    // Resolve amount
    const amountCents = typeof body.amount_cents === 'number' && body.amount_cents > 0
        ? Math.round(body.amount_cents)
        : client.billing_amount_cents;

    if (!amountCents || amountCents <= 0) {
        return badRequest('No invoice amount specified. Provide amount_cents or configure billing_amount_cents on the client.');
    }

    const description = typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : 'AI Voice Agent Service';

    const stripe = getStripe();
    const stripeAccountOptions = { stripeAccount: agency.stripe_connect_account_id };

    try {
        // Create invoice item
        await stripe.invoiceItems.create(
            {
                customer: client.stripe_customer_id,
                amount: amountCents,
                currency: 'usd',
                description,
            },
            stripeAccountOptions
        );

        // Calculate platform fee
        const feePercent = agency.platform_fee_percent || 0;
        const applicationFeeAmount = feePercent > 0
            ? Math.round(amountCents * (feePercent / 100))
            : undefined;

        // Create and auto-advance invoice
        const invoice = await stripe.invoices.create(
            {
                customer: client.stripe_customer_id,
                auto_advance: true,
                collection_method: 'send_invoice',
                days_until_due: 30,
                ...(applicationFeeAmount && { application_fee_amount: applicationFeeAmount }),
            },
            stripeAccountOptions
        );

        // Finalize the invoice so it gets a hosted URL
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(
            invoice.id,
            {},
            stripeAccountOptions
        );

        console.log(`One-time invoice created for ${client.name}: $${(amountCents / 100).toFixed(2)} (${finalizedInvoice.id})`);

        return apiSuccess({
            invoice_id: finalizedInvoice.id,
            hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
            amount_cents: amountCents,
            status: finalizedInvoice.status,
        });
    } catch (err) {
        console.error(`Failed to create one-time invoice for client ${client.name}:`, err instanceof Error ? err.message : 'Unknown error');
        if (err instanceof Stripe.errors.StripeError) {
            return externalServiceError('Stripe', 'Failed to create invoice');
        }
        throw err;
    }
});
