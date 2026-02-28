/**
 * Stripe Metered Billing — Per-Minute Usage Reporting via Billing Meters
 *
 * Reports call minutes to Stripe when platform API keys are used.
 * Flat $0.15/min across all tiers, billed at end of billing period.
 *
 * Uses Stripe's Billing Meters API (meter events) with unique identifiers
 * for built-in deduplication on webhook retries.
 */

import { getStripe } from '@/lib/stripe';

interface ReportUsageParams {
    /** Stripe customer ID for the agency */
    stripeCustomerId: string;
    /** Call duration in minutes (will be rounded up to nearest minute) */
    minutes: number;
    /** Unix timestamp (seconds) of when the call ended */
    timestamp: number;
    /** Unique identifier for deduplication (e.g., `retell_call_${callId}`) */
    identifier: string;
}

/**
 * Report metered usage to Stripe via Billing Meter events.
 *
 * Each call's duration is rounded up to the nearest minute (industry standard).
 * The meter event is sent with the `voice_minutes` event name, which maps to the
 * metered price in Stripe ($0.15/unit where 1 unit = 1 minute).
 *
 * @throws Will throw on Stripe API errors — callers should catch and log.
 */
export async function reportMeteredUsage(params: ReportUsageParams): Promise<void> {
    const { stripeCustomerId, minutes, timestamp, identifier } = params;

    // Round up to nearest whole minute (industry standard for telephony)
    const value = Math.ceil(minutes);
    if (value <= 0) return;

    const stripe = getStripe();

    await stripe.billing.meterEvents.create({
        event_name: 'voice_minutes',
        timestamp,
        payload: {
            stripe_customer_id: stripeCustomerId,
            value: String(value),
        },
        identifier,
    });
}
