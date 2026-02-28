import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { isValidUuid } from '@/lib/validation';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/clients/[id]/billing/setup-intent
 *
 * Creates a Stripe SetupIntent on the agency's connected account
 * to collect a payment method for the client.
 *
 * Returns { client_secret } for use with Stripe Elements on the frontend.
 */
export async function POST(
    _request: NextRequest,
    context: RouteParams
) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: clientId } = await context.params;

        if (!isValidUuid(clientId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify client belongs to this agency and get stripe_customer_id
        const { data: client } = await supabase
            .from('clients')
            .select('id, name, stripe_customer_id, billing_type')
            .eq('id', clientId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        // Get agency's Connect account
        const { data: agency } = await supabase
            .from('agencies')
            .select('stripe_connect_account_id, stripe_connect_charges_enabled')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.stripe_connect_account_id) {
            return NextResponse.json(
                { error: 'Connect your Stripe account first in Settings' },
                { status: 400 }
            );
        }

        if (!agency.stripe_connect_charges_enabled) {
            return NextResponse.json(
                { error: 'Stripe account setup is not complete. Please finish onboarding.' },
                { status: 400 }
            );
        }

        const stripe = getStripe();
        const stripeAccountOptions = { stripeAccount: agency.stripe_connect_account_id };

        // Create Stripe Customer on connected account if needed
        let customerId = client.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create(
                {
                    name: client.name,
                    metadata: { client_id: client.id, agency_id: user.agency.id },
                },
                stripeAccountOptions
            );
            customerId = customer.id;

            // Store customer ID
            await supabase
                .from('clients')
                .update({ stripe_customer_id: customerId })
                .eq('id', client.id);
        }

        // Create SetupIntent
        const setupIntent = await stripe.setupIntents.create(
            {
                customer: customerId,
                usage: 'off_session',
                metadata: { client_id: client.id },
            },
            stripeAccountOptions
        );

        return NextResponse.json({
            client_secret: setupIntent.client_secret,
            stripe_account_id: agency.stripe_connect_account_id,
        });
    } catch (error) {
        console.error('SetupIntent creation error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
    }
}
