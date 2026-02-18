/**
 * Plan Tier Definitions
 *
 * Single source of truth for Starter / Growth / Scale pricing tiers.
 * Price IDs are read from environment variables so they can differ
 * across dev / staging / production (and test mode vs live mode).
 */

export type PlanTier = 'starter' | 'growth' | 'scale';

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
    limits: TierLimits;
    features: string[];
}

const TIER_CONFIGS: Omit<TierDefinition, 'priceId'>[] = [
    {
        tier: 'starter',
        name: 'Starter',
        monthlyPrice: 99,
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
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
    },
    {
        tier: 'growth',
        name: 'Growth',
        monthlyPrice: 249,
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
            'Custom domain',
        ],
    },
    {
        tier: 'scale',
        name: 'Scale',
        monthlyPrice: 499,
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

/**
 * Get all tier definitions with price IDs resolved from env vars.
 * Tiers without a configured price ID are excluded.
 */
export function getTierDefinitions(): TierDefinition[] {
    return TIER_CONFIGS.map(config => ({
        ...config,
        priceId: process.env[PRICE_ENV_VARS[config.tier]] || '',
    })).filter(t => t.priceId !== '');
}

/**
 * Get a single tier definition by tier name.
 * Returns null if the tier's price ID is not configured.
 */
export function getTierDefinition(tier: PlanTier): TierDefinition | null {
    const priceId = process.env[PRICE_ENV_VARS[tier]];
    if (!priceId) return null;

    const config = TIER_CONFIGS.find(c => c.tier === tier);
    if (!config) return null;

    return { ...config, priceId };
}

/**
 * Reverse-lookup: map a Stripe price_id back to a PlanTier.
 * Also checks the legacy STRIPE_PRICE_ID env var (mapped to Growth as default).
 */
export function getTierFromPriceId(priceId: string): PlanTier | null {
    if (!priceId) return null;

    // Check each tier's env var
    for (const [tier, envVar] of Object.entries(PRICE_ENV_VARS)) {
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
export function getTierConfig(tier: PlanTier): Omit<TierDefinition, 'priceId'> | null {
    return TIER_CONFIGS.find(c => c.tier === tier) || null;
}

/**
 * Get all tier configs for display purposes (no priceId needed).
 */
export function getAllTierConfigs(): Omit<TierDefinition, 'priceId'>[] {
    return [...TIER_CONFIGS];
}
