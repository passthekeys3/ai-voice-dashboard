import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { createServiceClient } from '@/lib/supabase/server';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-01-28.clover',
    });
}

const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

/**
 * Handle Stripe Connect webhook events.
 *
 * These are events from connected accounts (agencies' Express accounts).
 * Each event includes an `account` field identifying the connected account.
 */
export async function POST(request: NextRequest) {
    try {
        if (!webhookSecret) {
            console.error('STRIPE_CONNECT_WEBHOOK_SECRET not configured');
            return NextResponse.json({ received: true, warning: 'Webhook not configured' }, { status: 200 });
        }

        const body = await request.text();
        const headersList = await headers();
        const signature = headersList.get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ error: 'No signature' }, { status: 400 });
        }

        const stripe = getStripe();
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
            console.error('Stripe Connect webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        const handleEvent = async () => {
            const supabase = createServiceClient();

            switch (event.type) {
                case 'account.updated': {
                    const account = event.data.object as Stripe.Account;

                    // Update agency's Connect status
                    const { error } = await supabase
                        .from('agencies')
                        .update({
                            stripe_connect_charges_enabled: account.charges_enabled,
                            stripe_connect_payouts_enabled: account.payouts_enabled,
                            stripe_connect_onboarding_complete: account.details_submitted,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('stripe_connect_account_id', account.id);

                    if (error) {
                        console.error(`Failed to update Connect status for account ${account.id}:`, error.code);
                    } else {
                        console.log(`Connect account ${account.id} updated: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}`);
                    }
                    break;
                }

                case 'account.application.deauthorized': {
                    // Agency disconnected from their Stripe dashboard
                    const account = event.account as string;

                    // Look up the agency
                    const { data: agency } = await supabase
                        .from('agencies')
                        .select('id')
                        .eq('stripe_connect_account_id', account)
                        .single();

                    if (agency) {
                        // Clear Connect fields
                        await supabase
                            .from('agencies')
                            .update({
                                stripe_connect_account_id: null,
                                stripe_connect_onboarding_complete: false,
                                stripe_connect_charges_enabled: false,
                                stripe_connect_payouts_enabled: false,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', agency.id);

                        // Clear client Stripe customer IDs (those customers no longer exist)
                        await supabase
                            .from('clients')
                            .update({ stripe_customer_id: null })
                            .eq('agency_id', agency.id)
                            .not('stripe_customer_id', 'is', null);

                        console.log(`Connect account ${account} deauthorized for agency ${agency.id}`);
                    }
                    break;
                }

                case 'invoice.paid': {
                    // Invoice paid on a connected account — log success
                    const invoice = event.data.object as Stripe.Invoice;
                    const connectedAccountId = event.account;
                    console.log(`Connect invoice ${invoice.id} paid on account ${connectedAccountId}: $${((invoice.amount_paid || 0) / 100).toFixed(2)}`);

                    // Optionally send Slack notification
                    if (connectedAccountId) {
                        const { data: agency } = await supabase
                            .from('agencies')
                            .select('id, name, integrations')
                            .eq('stripe_connect_account_id', connectedAccountId)
                            .single();

                        if (agency) {
                            const slackConfig = (agency.integrations as Record<string, unknown> | null)?.slack as { enabled?: boolean; webhook_url?: string } | undefined;
                            if (slackConfig?.enabled && slackConfig.webhook_url) {
                                try {
                                    const { sendSlackMessage } = await import('@/lib/integrations/slack');
                                    await sendSlackMessage(slackConfig.webhook_url, {
                                        text: `Client payment received: $${((invoice.amount_paid || 0) / 100).toFixed(2)}`,
                                        blocks: [
                                            {
                                                type: 'section',
                                                text: {
                                                    type: 'mrkdwn',
                                                    text: `:white_check_mark: *Client Payment Received*\nAmount: $${((invoice.amount_paid || 0) / 100).toFixed(2)}\nInvoice: ${invoice.id}`,
                                                },
                                            },
                                        ],
                                    });
                                } catch (err) {
                                    console.error('Failed to send Slack notification for Connect invoice:', err instanceof Error ? err.message : 'Unknown error');
                                }
                            }
                        }
                    }
                    break;
                }

                case 'invoice.payment_failed': {
                    // Payment failed on a connected account
                    const invoice = event.data.object as Stripe.Invoice;
                    const connectedAccountId = event.account;
                    console.warn(`Connect invoice ${invoice.id} payment failed on account ${connectedAccountId}`);

                    // Send Slack notification
                    if (connectedAccountId) {
                        const { data: agency } = await supabase
                            .from('agencies')
                            .select('id, name, integrations')
                            .eq('stripe_connect_account_id', connectedAccountId)
                            .single();

                        if (agency) {
                            const slackConfig = (agency.integrations as Record<string, unknown> | null)?.slack as { enabled?: boolean; webhook_url?: string } | undefined;
                            if (slackConfig?.enabled && slackConfig.webhook_url) {
                                try {
                                    const { sendSlackMessage, buildAlertPayload } = await import('@/lib/integrations/slack');
                                    const amountDue = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(2)}` : 'unknown amount';
                                    const payload = buildAlertPayload(
                                        'Client Payment Failed',
                                        `A client invoice payment of ${amountDue} failed. The client may need to update their payment method.`
                                    );
                                    await sendSlackMessage(slackConfig.webhook_url, payload);
                                } catch (err) {
                                    console.error('Failed to send Slack notification for Connect payment failure:', err instanceof Error ? err.message : 'Unknown error');
                                }
                            }
                        }
                    }
                    break;
                }

                default:
                    console.log(`Unhandled Stripe Connect event type: ${event.type}`);
            }
        };

        waitUntil(handleEvent().catch(err => {
            console.error(`Error handling Stripe Connect event ${event.type}:`, err instanceof Error ? err.message : 'Unknown error');
        }));

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Stripe Connect webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ received: true, warning: 'Processing error' }, { status: 200 });
    }
}
