import Stripe from 'stripe';

/** Stripe API version used across the application */
const STRIPE_API_VERSION = '2026-01-28.clover' as const;

let stripeInstance: Stripe | null = null;

/**
 * Get a shared Stripe client instance.
 * Lazily initializes and reuses a single Stripe client.
 */
export function getStripe(): Stripe {
    if (stripeInstance) return stripeInstance;

    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }

    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: STRIPE_API_VERSION,
    });

    return stripeInstance;
}
