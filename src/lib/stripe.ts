import Stripe from 'stripe';

/**
 * Stripe API version used across the application. Must match the stripe-node
 * major version (v23 = endive). Webhook payload shapes are set separately by
 * each endpoint's API version in the Stripe Dashboard.
 */
const STRIPE_API_VERSION = '2026-09-30.endive' as const;

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
