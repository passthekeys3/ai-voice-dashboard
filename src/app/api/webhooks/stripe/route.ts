import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { paymentReceivedEmail, paymentFailedEmail } from '@/lib/email/templates';
import { getTierFromPriceId } from '@/lib/billing/tiers';
import { getStripe } from '@/lib/stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
        'trialing': 'trialing',
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'canceled',
        'unpaid': 'unpaid',
        'incomplete': 'incomplete',
        'incomplete_expired': 'incomplete_expired',
        'paused': 'paused',
    };
    if (!statusMap[stripeStatus]) {
        console.warn(`Unmapped Stripe subscription status: ${stripeStatus}, defaulting to 'incomplete'`);
    }
    return statusMap[stripeStatus] || 'incomplete';
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
    const supabase = createServiceClient();
    const customerId = subscription.customer as string;

    // Find the base item (non-metered) — metered billing is handled via Stripe Meters, not subscription items
    const baseItem = subscription.items.data.find(item =>
        !item.price.recurring || item.price.recurring.usage_type !== 'metered'
    ) || subscription.items.data[0];

    const periodStart = baseItem?.current_period_start
        ? new Date(baseItem.current_period_start * 1000).toISOString()
        : null;
    const periodEnd = baseItem?.current_period_end
        ? new Date(baseItem.current_period_end * 1000).toISOString()
        : null;

    // Extract plan_type from metadata (defaults to self_service for legacy subscriptions)
    const planType = subscription.metadata?.plan_type || 'self_service';

    // Get agency by stripe_customer_id
    const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (agencyError || !agency) {
        // Fallback: use agency_id from subscription metadata (set by our checkout code).
        // This handles the first subscription event before stripe_customer_id is stored.
        // Safe because Stripe webhook signatures prevent external spoofing of metadata.
        const agencyId = subscription.metadata?.agency_id;
        if (!agencyId) {
            console.error(`No agency found for Stripe customer ${customerId}`);
            return;
        }

        // Defense-in-depth: verify the target agency doesn't already belong to a different Stripe customer
        const { data: targetAgency } = await supabase
            .from('agencies')
            .select('id, stripe_customer_id')
            .eq('id', agencyId)
            .single();

        if (!targetAgency) {
            console.error(`Agency ${agencyId} from subscription metadata not found`);
            return;
        }

        if (targetAgency.stripe_customer_id && targetAgency.stripe_customer_id !== customerId) {
            console.error(`SECURITY: Agency ${agencyId} already has stripe_customer_id ${targetAgency.stripe_customer_id}, refusing to overwrite with ${customerId}`);
            return;
        }

        // Update using agency_id from metadata
        const { error: updateError } = await supabase
            .from('agencies')
            .update({
                stripe_customer_id: customerId,
                subscription_id: subscription.id,
                subscription_status: mapStripeStatus(subscription.status),
                subscription_price_id: baseItem?.price?.id || null,
                subscription_current_period_start: periodStart,
                subscription_current_period_end: periodEnd,
                subscription_cancel_at_period_end: subscription.cancel_at_period_end,
                plan_type: planType,
            })
            .eq('id', agencyId);

        if (updateError) {
            console.error('Error updating agency subscription:', updateError.code);
        } else {
            console.info(`Updated subscription for agency ${agencyId}: ${subscription.status}`);
        }
        return;
    }

    // Update agency subscription status
    const { error: updateError } = await supabase
        .from('agencies')
        .update({
            subscription_id: subscription.id,
            subscription_status: mapStripeStatus(subscription.status),
            subscription_price_id: baseItem?.price?.id || null,
            subscription_current_period_start: periodStart,
            subscription_current_period_end: periodEnd,
            subscription_cancel_at_period_end: subscription.cancel_at_period_end,
            plan_type: planType,
        })
        .eq('id', agency.id);

    if (updateError) {
        console.error('Error updating agency subscription:', updateError.code);
    } else {
        console.info(`Updated subscription for agency ${agency.id}: ${subscription.status}`);
    }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const supabase = createServiceClient();
    const customerId = subscription.customer as string;

    // Get agency by stripe_customer_id or subscription_id
    const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id')
        .or(`stripe_customer_id.eq.${customerId},subscription_id.eq.${subscription.id}`)
        .single();

    if (agencyError || !agency) {
        console.error(`No agency found for deleted subscription ${subscription.id}`);
        return;
    }

    // Clear subscription data but keep customer_id and plan_type for future use.
    // plan_type is intentionally preserved so re-subscribing defaults to their previous preference.
    const { error: updateError } = await supabase
        .from('agencies')
        .update({
            subscription_id: null,
            subscription_status: 'canceled',
            subscription_price_id: null,
            subscription_current_period_start: null,
            subscription_current_period_end: null,
            subscription_cancel_at_period_end: false,
        })
        .eq('id', agency.id);

    if (updateError) {
        console.error('Error clearing agency subscription:', updateError.code);
    } else {
        console.info(`Subscription deleted for agency ${agency.id}`);
    }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
    const supabase = createServiceClient();
    const customerId = invoice.customer as string;

    // Get agency + admin profile for email notification
    const { data: agency } = await supabase
        .from('agencies')
        .select('id, name, subscription_price_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (agency) {
        console.info(`Invoice ${invoice.id} paid for agency ${agency.name} (${agency.id})`);

        // Send payment confirmation email to agency admin
        const { data: admin } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('agency_id', agency.id)
            .eq('role', 'agency_admin')
            .limit(1)
            .single();

        if (admin?.email && invoice.amount_paid) {
            const tierInfo = getTierFromPriceId(agency.subscription_price_id || '');
            const tierLabel = tierInfo ? tierInfo.tier.charAt(0).toUpperCase() + tierInfo.tier.slice(1) : '';
            const typeLabel = tierInfo?.planType === 'managed' ? 'Managed ' : '';
            const planName = tierLabel ? `${typeLabel}${tierLabel}` : 'Subscription';
            const amount = `$${(invoice.amount_paid / 100).toFixed(2)}`;
            const invoiceUrl = invoice.hosted_invoice_url || undefined;

            await sendEmail({
                to: admin.email,
                ...paymentReceivedEmail({
                    userName: admin.full_name || 'there',
                    planName,
                    amount,
                    invoiceUrl,
                }),
            }).catch(() => { /* logged inside sendEmail */ });
        }
    }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const supabase = createServiceClient();
    const customerId = invoice.customer as string;

    // Get agency by stripe_customer_id (include integrations for Slack + subscription info for email)
    const { data: agency } = await supabase
        .from('agencies')
        .select('id, name, integrations, subscription_price_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (agency) {
        console.warn(`Invoice ${invoice.id} payment failed for agency ${agency.name} (${agency.id})`);

        // Send payment failed email to agency admin
        const { data: admin } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('agency_id', agency.id)
            .eq('role', 'agency_admin')
            .limit(1)
            .single();

        if (admin?.email) {
            const tierInfo2 = getTierFromPriceId(agency.subscription_price_id || '');
            const tierLabel2 = tierInfo2 ? tierInfo2.tier.charAt(0).toUpperCase() + tierInfo2.tier.slice(1) : '';
            const typeLabel2 = tierInfo2?.planType === 'managed' ? 'Managed ' : '';
            const planName = tierLabel2 ? `${typeLabel2}${tierLabel2}` : 'Subscription';
            const amount = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(2)}` : 'your subscription';

            await sendEmail({
                to: admin.email,
                ...paymentFailedEmail({
                    userName: admin.full_name || 'there',
                    planName,
                    amount,
                }),
            }).catch(() => { /* logged inside sendEmail */ });
        }

        // Send Slack notification if agency has Slack enabled
        const slackConfig = (agency.integrations as Record<string, unknown> | null)?.slack as { enabled?: boolean; webhook_url?: string } | undefined;
        if (slackConfig?.enabled && slackConfig.webhook_url) {
            try {
                const { sendSlackMessage, buildAlertPayload } = await import('@/lib/integrations/slack');
                const amountDue = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(2)}` : 'unknown amount';
                const payload = buildAlertPayload(
                    'Payment Failed',
                    `Invoice payment of ${amountDue} failed for *${agency.name}*. Please update your payment method to avoid service interruption.`
                );
                await sendSlackMessage(slackConfig.webhook_url, payload);
            } catch (err) {
                console.error('Failed to send Slack payment failure notification:', err instanceof Error ? err.message : 'Unknown error');
            }
        }
    }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    // If this was a subscription checkout, the subscription webhooks will handle the update
    // This handler is useful for one-time purchases or additional checkout logic
    const agencyId = session.metadata?.agency_id;
    if (agencyId) {
        console.info(`Checkout session completed for agency ${agencyId}`);
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!webhookSecret) {
            console.error('Stripe webhook secret not configured — returning 503 so Stripe retries');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
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
            console.error('Stripe webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // Only process event types we explicitly handle — ignore the rest early
        const HANDLED_EVENTS = new Set([
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'invoice.paid',
            'invoice.payment_failed',
            'checkout.session.completed',
        ]);

        if (!HANDLED_EVENTS.has(event.type)) {
            // Acknowledge but do not process unknown event types
            return NextResponse.json({ received: true });
        }

        // Deduplicate — atomic insert prevents race conditions on concurrent deliveries
        const supabase = createServiceClient();
        const { error: insertError } = await supabase
            .from('webhook_events')
            .insert({ event_id: event.id });

        if (insertError) {
            // PK violation means this event was already processed — safe to skip
            return NextResponse.json({ received: true, duplicate: true });
        }

        // Handle the event — use waitUntil to ensure completion in serverless
        const handleEvent = async () => {
            switch (event.type) {
                case 'customer.subscription.created':
                case 'customer.subscription.updated': {
                    const subscription = event.data.object as Stripe.Subscription;
                    await handleSubscriptionChange(subscription);
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object as Stripe.Subscription;
                    await handleSubscriptionDeleted(subscription);
                    break;
                }

                case 'invoice.paid': {
                    const invoice = event.data.object as Stripe.Invoice;
                    await handleInvoicePaid(invoice);
                    break;
                }

                case 'invoice.payment_failed': {
                    const invoice = event.data.object as Stripe.Invoice;
                    await handleInvoicePaymentFailed(invoice);
                    break;
                }

                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    await handleCheckoutSessionCompleted(session);
                    break;
                }
            }
        };

        waitUntil(handleEvent().catch(err => {
            console.error(`Error handling Stripe event ${event.type}:`, err instanceof Error ? err.message : 'Unknown error');
        }));

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ received: true, warning: 'Processing error' }, { status: 200 });
    }
}
