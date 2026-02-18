/**
 * Plan Tier Definitions
 *
 * Single source of truth for Starter / Growth / Scale pricing tiers.
 * Price IDs are read from environment variables so they can differ
 * across dev / staging / production (and test mode vs live mode).
 *
 * Yearly pricing = 10 months (2 months free).
 */

export type PlanTier = 'starter' | 'growth' | 'scale';
export type BillingInterval = 'monthly' | 'yearly';

export interface TierLimits {
    maxAgents: number;
    maxCallMinutesPerMonth: number;
    maxClients: number;
    additionalClientPrice: number; // $/client overage
}

export interface TierDefinition {
    tier: PlanTier;
    name: string;
    priceId: string;
    monthlyPrice: number; // Display price in dollars
    yearlyPrice: number; // Total yearly price (10 months)
    yearlyMonthly: number; // Effective monthly when billed yearly
    yearlyPriceId: string;
    limits: TierLimits;
    features: string[];
}

interface TierConfig {
    tier: PlanTier;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number; // Total yearly price
    yearlyMonthly: number; // Effective monthly rate when billed yearly
    limits: TierLimits;
    features: string[];
}

const TIER_CONFIGS: TierConfig[] = [
    {
        tier: 'starter',
        name: 'Starter',
        monthlyPrice: 99,
        yearlyPrice: 990, // 10 × $99 (save $198)
        yearlyMonthly: 83, // $990 / 12
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 3,
            additionalClientPrice: 15,
        },
        features: [
            '3 Clients included',
            '$15/client for additional clients',
            'Unlimited agents',
            'AI Agent Builder',
            'Custom domain',
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
    },
    {
        tier: 'growth',
        name: 'Growth',
        monthlyPrice: 249,
        yearlyPrice: 2490, // 10 × $249 (save $498)
        yearlyMonthly: 208, // $2490 / 12
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 5,
            additionalClientPrice: 12,
        },
        features: [
            '5 Clients included',
            '$12/client for additional clients',
            'All Starter features',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
        ],
    },
    {
        tier: 'scale',
        name: 'Scale',
        monthlyPrice: 499,
        yearlyPrice: 4990, // 10 × $499 (save $998)
        yearlyMonthly: 416, // $4990 / 12
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 10,
            additionalClientPrice: 10,
        },
        features: [
            '10 Clients included',
            '$10/client for additional clients',
            'All features',
            'White-label platform',
            'API access',
            'Priority support',
        ],
    },
];

/**
 * Environment variable names for each tier's Stripe Price ID.
 */
const PRICE_ENV_VARS: Record<PlanTier, string> = {
    starter: 'STRIPE_PRICE_ID_STARTER',
    growth: 'STRIPE_PRICE_ID_GROWTH',
    scale: 'STRIPE_PRICE_ID_SCALE',
};

const YEARLY_PRICE_ENV_VARS: Record<PlanTier, string> = {
    starter: 'STRIPE_PRICE_ID_STARTER_YEARLY',
    growth: 'STRIPE_PRICE_ID_GROWTH_YEARLY',
    scale: 'STRIPE_PRICE_ID_SCALE_YEARLY',
};

/**
 * Get all tier definitions with price IDs resolved from env vars.
 * Tiers without a configured price ID are excluded.
 */
export function getTierDefinitions(): TierDefinition[] {
    return TIER_CONFIGS.map(config => ({
        ...config,
        priceId: process.env[PRICE_ENV_VARS[config.tier]] || '',
        yearlyPriceId: process.env[YEARLY_PRICE_ENV_VARS[config.tier]] || '',
    })).filter(t => t.priceId !== '');
}

/**
 * Get a single tier definition by tier name.
 * Returns null if the tier's monthly price ID is not configured.
 */
export function getTierDefinition(tier: PlanTier): TierDefinition | null {
    const priceId = process.env[PRICE_ENV_VARS[tier]];
    if (!priceId) return null;

    const config = TIER_CONFIGS.find(c => c.tier === tier);
    if (!config) return null;

    return {
        ...config,
        priceId,
        yearlyPriceId: process.env[YEARLY_PRICE_ENV_VARS[tier]] || '',
    };
}

/**
 * Get the Stripe price ID for a tier and interval.
 */
export function getPriceId(tier: PlanTier, interval: BillingInterval = 'monthly'): string | null {
    const envVar = interval === 'yearly'
        ? YEARLY_PRICE_ENV_VARS[tier]
        : PRICE_ENV_VARS[tier];
    return process.env[envVar] || null;
}

/**
 * Reverse-lookup: map a Stripe price_id back to a PlanTier.
 * Checks both monthly and yearly price IDs.
 * Also checks the legacy STRIPE_PRICE_ID env var (mapped to Growth as default).
 */
export function getTierFromPriceId(priceId: string): PlanTier | null {
    if (!priceId) return null;

    // Check each tier's monthly env var
    for (const [tier, envVar] of Object.entries(PRICE_ENV_VARS)) {
        if (process.env[envVar] === priceId) {
            return tier as PlanTier;
        }
    }

    // Check each tier's yearly env var
    for (const [tier, envVar] of Object.entries(YEARLY_PRICE_ENV_VARS)) {
        if (process.env[envVar] === priceId) {
            return tier as PlanTier;
        }
    }

    // Backward compat: legacy single STRIPE_PRICE_ID maps to growth
    if (process.env.STRIPE_PRICE_ID === priceId) {
        return 'growth';
    }

    return null;
}

/**
 * Check if a price ID is a yearly plan.
 */
export function isYearlyPriceId(priceId: string): boolean {
    if (!priceId) return false;
    for (const envVar of Object.values(YEARLY_PRICE_ENV_VARS)) {
        if (process.env[envVar] === priceId) return true;
    }
    return false;
}

/**
 * Check whether the given usage exceeds a tier's limits.
 */
export function checkTierLimits(
    tier: PlanTier,
    usage: { agentCount: number; callMinutes: number; clientCount: number }
): { exceeded: boolean; details: string[] } {
    const def = getTierDefinition(tier);
    if (!def) return { exceeded: false, details: [] };

    const details: string[] = [];

    if (usage.agentCount > def.limits.maxAgents) {
        details.push(`Agent limit exceeded (${usage.agentCount}/${def.limits.maxAgents})`);
    }
    if (usage.callMinutes > def.limits.maxCallMinutesPerMonth) {
        details.push(`Call minutes exceeded (${Math.round(usage.callMinutes)}/${def.limits.maxCallMinutesPerMonth})`);
    }
    if (usage.clientCount > def.limits.maxClients) {
        details.push(`Client limit exceeded (${usage.clientCount}/${def.limits.maxClients})`);
    }

    return { exceeded: details.length > 0, details };
}

/**
 * Get the tier config (without priceId) for display purposes.
 * Works even when env vars aren't set (useful for client-side).
 */
export function getTierConfig(tier: PlanTier): TierConfig | null {
    return TIER_CONFIGS.find(c => c.tier === tier) || null;
}

/**
 * Get all tier configs for display purposes (no priceId needed).
 */
export function getAllTierConfigs(): TierConfig[] {
    return [...TIER_CONFIGS];
}
