/**
 * Stripe Metered Billing — Per-Minute Usage Reporting
 *
 * Reports call minutes to Stripe when platform API keys are used.
 * Flat $0.15/min across all tiers, billed at end of billing period.
 *
 * Uses Stripe's usage_records API with idempotency keys to prevent
 * double-counting on webhook retries.
 */

import Stripe from 'stripe';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-01-28.clover',
    });
}

interface ReportUsageParams {
    /** Stripe subscription item ID for the metered component */
    subscriptionItemId: string;
    /** Call duration in minutes (will be rounded up to nearest minute) */
    minutes: number;
    /** Unix timestamp (seconds) of when the call ended */
    timestamp: number;
    /** Idempotency key to prevent double-counting (e.g., `call_${externalId}`) */
    idempotencyKey: string;
}

/**
 * Report metered usage to Stripe for per-minute billing.
 *
 * Each call's duration is rounded up to the nearest minute (industry standard).
 * The Stripe metered price should be set to $0.15/unit (1 unit = 1 minute).
 *
 * @throws Will throw on Stripe API errors — callers should catch and log.
 */
export async function reportMeteredUsage(params: ReportUsageParams): Promise<void> {
    const { subscriptionItemId, minutes, timestamp, idempotencyKey } = params;

    // Round up to nearest whole minute (industry standard for telephony)
    const quantity = Math.ceil(minutes);
    if (quantity <= 0) return;

    const stripe = getStripe();

    // Use the raw API to create usage records, which works across all Stripe SDK versions
    await stripe.rawRequest('POST', `/v1/subscription_items/${subscriptionItemId}/usage_records`, {
        body: new URLSearchParams({
            quantity: String(quantity),
            timestamp: String(timestamp),
            action: 'increment',
        }).toString(),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': idempotencyKey,
        },
    });
}
