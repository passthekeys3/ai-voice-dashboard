import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Monthly Invoice Generation Cron
 *
 * POST /api/cron/generate-invoices
 *
 * Runs on the 1st of each month at 6 AM UTC.
 * For each client with per_minute billing and a Stripe customer ID,
 * creates a Stripe invoice for the previous month's usage.
 *
 * Protected by CRON_SECRET bearer token.
 */

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-01-28.clover',
    });
}

export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET not configured - rejecting cron request for security');
            return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // Calculate previous month's period
        const now = new Date();
        const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const periodStart = prevMonth.toISOString().split('T')[0];
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
            .toISOString().split('T')[0];
        const monthLabel = prevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

        // Get all per_minute clients with Stripe customer IDs, joined with agency Connect info
        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select(`
                id, name, stripe_customer_id, billing_amount_cents, agency_id,
                agencies!inner (
                    id,
                    stripe_connect_account_id,
                    stripe_connect_charges_enabled,
                    platform_fee_percent
                )
            `)
            .eq('billing_type', 'per_minute')
            .eq('is_active', true)
            .not('stripe_customer_id', 'is', null);

        if (clientsError) {
            console.error('Failed to fetch clients for invoicing:', clientsError);
            return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
        }

        const stripe = getStripe();
        const results: { clientId: string; clientName: string; billingType: string; status: string; amount?: number }[] = [];

        // ---- Per-Minute Clients ----
        if (clients && clients.length > 0) {
            for (const client of clients) {
                try {
                    const agency = client.agencies as unknown as {
                        id: string;
                        stripe_connect_account_id: string | null;
                        stripe_connect_charges_enabled: boolean;
                        platform_fee_percent: number | null;
                    };

                    if (!agency?.stripe_connect_account_id || !agency.stripe_connect_charges_enabled) {
                        results.push({ clientId: client.id, clientName: client.name, billingType: 'per_minute', status: 'skipped_no_connect' });
                        continue;
                    }

                    const stripeAccountOptions = { stripeAccount: agency.stripe_connect_account_id };

                    const { data: usage } = await supabase
                        .from('usage')
                        .select('total_calls, total_minutes, total_cost_cents')
                        .eq('client_id', client.id)
                        .eq('period_start', periodStart)
                        .eq('period_end', periodEnd)
                        .single();

                    if (!usage || usage.total_cost_cents <= 0) {
                        results.push({ clientId: client.id, clientName: client.name, billingType: 'per_minute', status: 'skipped_no_usage' });
                        continue;
                    }

                    await stripe.invoiceItems.create(
                        {
                            customer: client.stripe_customer_id!,
                            amount: usage.total_cost_cents,
                            currency: 'usd',
                            description: `Voice AI Usage: ${Number(usage.total_minutes).toFixed(1)} minutes (${usage.total_calls} calls) - ${monthLabel}`,
                        },
                        stripeAccountOptions
                    );

                    const feePercent = agency.platform_fee_percent || 0;
                    const applicationFeeAmount = feePercent > 0
                        ? Math.round(usage.total_cost_cents * (feePercent / 100))
                        : undefined;

                    const invoice = await stripe.invoices.create(
                        {
                            customer: client.stripe_customer_id!,
                            auto_advance: true,
                            collection_method: 'charge_automatically',
                            ...(applicationFeeAmount && { application_fee_amount: applicationFeeAmount }),
                        },
                        stripeAccountOptions
                    );

                    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
                    await supabase
                        .from('clients')
                        .update({ next_billing_date: nextMonth.toISOString() })
                        .eq('id', client.id);

                    results.push({ clientId: client.id, clientName: client.name, billingType: 'per_minute', status: 'invoiced', amount: usage.total_cost_cents });

                    const feeNote = applicationFeeAmount ? ` (platform fee: $${(applicationFeeAmount / 100).toFixed(2)})` : '';
                    console.log(`[per_minute] Invoice created for ${client.name}: $${(usage.total_cost_cents / 100).toFixed(2)}${feeNote} (${invoice.id})`);
                } catch (err) {
                    console.error(`Failed to create per_minute invoice for client ${client.name}:`, err);
                    results.push({ clientId: client.id, clientName: client.name, billingType: 'per_minute', status: 'error' });
                }
            }
        }

        // ---- Subscription (Fixed Monthly) Clients ----
        const { data: subClients, error: subClientsError } = await supabase
            .from('clients')
            .select(`
                id, name, stripe_customer_id, billing_amount_cents, agency_id,
                agencies!inner (
                    id,
                    stripe_connect_account_id,
                    stripe_connect_charges_enabled,
                    platform_fee_percent
                )
            `)
            .eq('billing_type', 'subscription')
            .eq('is_active', true)
            .not('stripe_customer_id', 'is', null);

        if (subClientsError) {
            console.error('Failed to fetch subscription clients for invoicing:', subClientsError);
        }

        if (subClients && subClients.length > 0) {
            for (const client of subClients) {
                try {
                    const agency = client.agencies as unknown as {
                        id: string;
                        stripe_connect_account_id: string | null;
                        stripe_connect_charges_enabled: boolean;
                        platform_fee_percent: number | null;
                    };

                    if (!agency?.stripe_connect_account_id || !agency.stripe_connect_charges_enabled) {
                        results.push({ clientId: client.id, clientName: client.name, billingType: 'subscription', status: 'skipped_no_connect' });
                        continue;
                    }

                    const amountCents = client.billing_amount_cents;
                    if (!amountCents || amountCents <= 0) {
                        results.push({ clientId: client.id, clientName: client.name, billingType: 'subscription', status: 'skipped_no_amount' });
                        continue;
                    }

                    const stripeAccountOptions = { stripeAccount: agency.stripe_connect_account_id };

                    await stripe.invoiceItems.create(
                        {
                            customer: client.stripe_customer_id!,
                            amount: amountCents,
                            currency: 'usd',
                            description: `Monthly AI Voice Agent Service - ${monthLabel}`,
                        },
                        stripeAccountOptions
                    );

                    const feePercent = agency.platform_fee_percent || 0;
                    const applicationFeeAmount = feePercent > 0
                        ? Math.round(amountCents * (feePercent / 100))
                        : undefined;

                    const invoice = await stripe.invoices.create(
                        {
                            customer: client.stripe_customer_id!,
                            auto_advance: true,
                            collection_method: 'charge_automatically',
                            ...(applicationFeeAmount && { application_fee_amount: applicationFeeAmount }),
                        },
                        stripeAccountOptions
                    );

                    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
                    await supabase
                        .from('clients')
                        .update({ next_billing_date: nextMonth.toISOString() })
                        .eq('id', client.id);

                    results.push({ clientId: client.id, clientName: client.name, billingType: 'subscription', status: 'invoiced', amount: amountCents });

                    const feeNote = applicationFeeAmount ? ` (platform fee: $${(applicationFeeAmount / 100).toFixed(2)})` : '';
                    console.log(`[subscription] Invoice created for ${client.name}: $${(amountCents / 100).toFixed(2)}${feeNote} (${invoice.id})`);
                } catch (err) {
                    console.error(`Failed to create subscription invoice for client ${client.name}:`, err);
                    results.push({ clientId: client.id, clientName: client.name, billingType: 'subscription', status: 'error' });
                }
            }
        }

        const invoicesCreated = results.filter(r => r.status === 'invoiced').length;
        const totalClients = (clients?.length || 0) + (subClients?.length || 0);
        console.log(`Invoice generation complete: ${invoicesCreated}/${totalClients} clients invoiced for ${monthLabel}`);

        return NextResponse.json({
            success: true,
            period: `${periodStart} to ${periodEnd}`,
            invoicesCreated,
            results,
        });
    } catch (err) {
        console.error('Invoice generation cron error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
