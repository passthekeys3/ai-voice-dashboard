/**
 * Plan Tier Definitions
 *
 * Single source of truth for Starter / Growth / Agency pricing tiers.
 * Supports two plan types: Self-Service and Managed (done-for-you).
 *
 * Price IDs are read from environment variables so they can differ
 * across dev / staging / production (and test mode vs live mode).
 *
 * Per-minute: Flat $0.15/min across all tiers when using platform API keys.
 * Yearly pricing = 10 months (2 months free).
 */

import type { PlanType } from '@/types/database';

export type PlanTier = 'starter' | 'growth' | 'agency';
export type BillingInterval = 'monthly' | 'yearly';

/** Features that are gated by tier */
export type TierFeature =
    | 'crm_integrations'    // GHL + HubSpot
    | 'white_label'         // Custom domains + branding
    | 'stripe_connect'      // Client billing via Stripe Connect
    | 'experiments'          // A/B testing
    | 'agent_testing'        // AI-powered agent test suites
    | 'api_access';         // External trigger API

/** Which features are available on each tier (Agency inherits all Growth features) */
const TIER_FEATURES: Record<PlanTier, TierFeature[]> = {
    starter: [],
    growth: ['crm_integrations', 'white_label', 'stripe_connect', 'experiments'],
    agency: ['crm_integrations', 'white_label', 'stripe_connect', 'experiments', 'agent_testing', 'api_access'],
};

/** Check if a tier has access to a specific feature */
export function hasFeature(tier: PlanTier, feature: TierFeature): boolean {
    return TIER_FEATURES[tier]?.includes(feature) ?? false;
}

/** Get the minimum tier required for a feature */
export function minimumTierForFeature(feature: TierFeature): PlanTier {
    if (TIER_FEATURES.starter.includes(feature)) return 'starter';
    if (TIER_FEATURES.growth.includes(feature)) return 'growth';
    return 'agency';
}

/** Human-readable label for a tier feature */
export function featureLabel(feature: TierFeature): string {
    const labels: Record<TierFeature, string> = {
        crm_integrations: 'CRM Integrations',
        white_label: 'White-Label & Custom Domains',
        stripe_connect: 'Stripe Connect Billing',
        experiments: 'A/B Experiments',
        agent_testing: 'Agent Testing',
        api_access: 'API Access',
    };
    return labels[feature];
}

/**
 * Standard 403 error message for a tier-gated feature.
 * Used by API routes to return consistent upgrade prompts.
 */
export function tierGateError(feature: TierFeature): string {
    const minTier = minimumTierForFeature(feature);
    const label = featureLabel(feature);
    const tierName = minTier === 'agency' ? 'an Agency' : `a ${minTier.charAt(0).toUpperCase() + minTier.slice(1)}`;
    return `${label} require${label.endsWith('s') ? '' : 's'} ${tierName} plan or higher. Please upgrade.`;
}

/** Subscription statuses that grant feature access */
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/**
 * Check if an agency has access to a tier-gated feature.
 * Validates both the subscription tier AND the subscription status
 * (blocks past_due, canceled, incomplete, etc.).
 *
 * For beta agencies (`subscription_price_id === 'beta_agency'`),
 * also checks that `betaEndsAt` hasn't passed. Expired betas
 * are denied access to all tier-gated features.
 *
 * @returns `null` if access is granted, or an error message string if denied.
 */
export function checkFeatureAccess(
    subscriptionPriceId: string | null | undefined,
    subscriptionStatus: string | null | undefined,
    feature: TierFeature,
    betaEndsAt?: string | null,
): string | null {
    // Beta expiry check — deny access if trial period has ended
    if (subscriptionPriceId === BETA_PRICE_ID && betaEndsAt) {
        if (new Date(betaEndsAt) < new Date()) {
            return 'Your beta trial has expired. Please subscribe to a paid plan to continue using this feature.';
        }
    }

    const tierInfo = getTierFromPriceId(subscriptionPriceId || '');
    if (!tierInfo || !hasFeature(tierInfo.tier, feature)) {
        return tierGateError(feature);
    }
    if (!subscriptionStatus || !ACTIVE_STATUSES.has(subscriptionStatus)) {
        return 'Your subscription is not active. Please update your billing to continue using this feature.';
    }
    return null;
}

export interface TierLimits {
    maxAgents: number;
    maxCallMinutesPerMonth: number;
    maxClients: number;
    additionalClientPrice: number; // $/client overage
}

export interface TierDefinition {
    tier: PlanTier;
    planType: PlanType;
    name: string;           // e.g., "Self-Service Starter"
    displayName: string;    // e.g., "Starter"
    monthlyPrice: number;
    yearlyPrice: number;    // Total yearly price (10 months)
    yearlyMonthly: number;  // Effective monthly when billed yearly
    perMinuteRate: number;  // $/minute for platform-key usage (0.15 for all tiers)
    limits: TierLimits;
    features: string[];
    // Resolved from env vars
    priceId: string;
    yearlyPriceId: string;
}

interface TierConfig {
    tier: PlanTier;
    planType: PlanType;
    name: string;
    displayName: string;
    monthlyPrice: number;
    yearlyPrice: number;
    yearlyMonthly: number;
    perMinuteRate: number;
    limits: TierLimits;
    features: string[];
}

/** Flat per-minute rate for platform-key usage across all tiers */
export const PLATFORM_PER_MINUTE_RATE = 0.15;

const TIER_CONFIGS: TierConfig[] = [
    // ---- Self-Service Plans ----
    {
        tier: 'starter',
        planType: 'self_service',
        name: 'Self-Service Starter',
        displayName: 'Starter',
        monthlyPrice: 67,
        yearlyPrice: 670,  // 10 × $67
        yearlyMonthly: 56, // $670 / 12
        perMinuteRate: PLATFORM_PER_MINUTE_RATE,
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 3,
            additionalClientPrice: 15,
        },
        features: [
            '3 Clients included',
            '$15/additional client',
            'Unlimited agents',
            'AI Agent Builder',
            'Call analytics',
            'Workflow automation',
            'Email support',
        ],
    },
    {
        tier: 'growth',
        planType: 'self_service',
        name: 'Self-Service Growth',
        displayName: 'Growth',
        monthlyPrice: 147,
        yearlyPrice: 1470,  // 10 × $147
        yearlyMonthly: 123, // $1470 / 12
        perMinuteRate: PLATFORM_PER_MINUTE_RATE,
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 10,
            additionalClientPrice: 12,
        },
        features: [
            '10 Clients included',
            '$12/additional client',
            'All Starter features',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
            'White-label & custom domains',
            'A/B Experiments',
        ],
    },
    {
        tier: 'agency',
        planType: 'self_service',
        name: 'Self-Service Agency',
        displayName: 'Agency',
        monthlyPrice: 297,
        yearlyPrice: 2970,  // 10 × $297
        yearlyMonthly: 248, // $2970 / 12
        perMinuteRate: PLATFORM_PER_MINUTE_RATE,
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 25,
            additionalClientPrice: 10,
        },
        features: [
            '25 Clients included',
            '$10/additional client',
            'All Growth features',
            'API access',
            'Priority support',
        ],
    },
    // ---- Managed (Done-for-you) Plans ----
    {
        tier: 'starter',
        planType: 'managed',
        name: 'Managed Starter',
        displayName: 'Starter',
        monthlyPrice: 97,
        yearlyPrice: 970,  // 10 × $97
        yearlyMonthly: 81, // $970 / 12
        perMinuteRate: PLATFORM_PER_MINUTE_RATE,
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 3,
            additionalClientPrice: 20, // SS + $5
        },
        features: [
            '3 Clients included',
            '$20/additional client',
            'Done-for-you agent setup',
            'AI Agent Builder',
            'Call analytics',
            'Workflow automation',
            'Priority support',
        ],
    },
    {
        tier: 'growth',
        planType: 'managed',
        name: 'Managed Growth',
        displayName: 'Growth',
        monthlyPrice: 197,
        yearlyPrice: 1970,  // 10 × $197
        yearlyMonthly: 164, // $1970 / 12
        perMinuteRate: PLATFORM_PER_MINUTE_RATE,
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 10,
            additionalClientPrice: 17, // SS + $5
        },
        features: [
            '10 Clients included',
            '$17/additional client',
            'All Starter features',
            'Done-for-you integrations',
            'CRM integrations (GHL + HubSpot)',
            'Stripe Connect client billing',
            'White-label & custom domains',
            'A/B Experiments',
        ],
    },
    {
        tier: 'agency',
        planType: 'managed',
        name: 'Managed Agency',
        displayName: 'Agency',
        monthlyPrice: 397,
        yearlyPrice: 3970,  // 10 × $397
        yearlyMonthly: 331, // $3970 / 12
        perMinuteRate: PLATFORM_PER_MINUTE_RATE,
        limits: {
            maxAgents: Infinity,
            maxCallMinutesPerMonth: Infinity,
            maxClients: 25,
            additionalClientPrice: 15, // SS + $5
        },
        features: [
            '25 Clients included',
            '$15/additional client',
            'All Growth features',
            'Done-for-you white-label setup',
            'API access',
            'Dedicated support',
        ],
    },
];

// ---- Environment Variable Mapping ----

const BASE_PRICE_ENV_VARS: Record<PlanType, Record<PlanTier, string>> = {
    self_service: {
        starter: 'STRIPE_PRICE_SELF_SERVICE_STARTER_MONTHLY',
        growth: 'STRIPE_PRICE_SELF_SERVICE_GROWTH_MONTHLY',
        agency: 'STRIPE_PRICE_SELF_SERVICE_AGENCY_MONTHLY',
    },
    managed: {
        starter: 'STRIPE_PRICE_MANAGED_STARTER_MONTHLY',
        growth: 'STRIPE_PRICE_MANAGED_GROWTH_MONTHLY',
        agency: 'STRIPE_PRICE_MANAGED_AGENCY_MONTHLY',
    },
};

const YEARLY_PRICE_ENV_VARS: Record<PlanType, Record<PlanTier, string>> = {
    self_service: {
        starter: 'STRIPE_PRICE_SELF_SERVICE_STARTER_YEARLY',
        growth: 'STRIPE_PRICE_SELF_SERVICE_GROWTH_YEARLY',
        agency: 'STRIPE_PRICE_SELF_SERVICE_AGENCY_YEARLY',
    },
    managed: {
        starter: 'STRIPE_PRICE_MANAGED_STARTER_YEARLY',
        growth: 'STRIPE_PRICE_MANAGED_GROWTH_YEARLY',
        agency: 'STRIPE_PRICE_MANAGED_AGENCY_YEARLY',
    },
};

const METERED_PRICE_ENV_VAR = 'STRIPE_PRICE_METERED_MINUTE';

// Legacy env vars for backward compatibility with existing subscriptions
const LEGACY_PRICE_ENV_VARS: Record<string, { tier: PlanTier; planType: PlanType }> = {
    STRIPE_PRICE_ID_STARTER: { tier: 'starter', planType: 'self_service' },
    STRIPE_PRICE_ID_GROWTH: { tier: 'growth', planType: 'self_service' },
    STRIPE_PRICE_ID_SCALE: { tier: 'agency', planType: 'self_service' }, // scale → agency
    STRIPE_PRICE_ID_STARTER_YEARLY: { tier: 'starter', planType: 'self_service' },
    STRIPE_PRICE_ID_GROWTH_YEARLY: { tier: 'growth', planType: 'self_service' },
    STRIPE_PRICE_ID_SCALE_YEARLY: { tier: 'agency', planType: 'self_service' },
};

// ---- Public API ----

/**
 * Get all tier definitions, optionally filtered by plan type.
 * Only returns tiers with configured price IDs.
 */
export function getTierDefinitions(planType?: PlanType): TierDefinition[] {
    const configs = planType
        ? TIER_CONFIGS.filter(c => c.planType === planType)
        : TIER_CONFIGS;

    return configs.map(config => ({
        ...config,
        priceId: process.env[BASE_PRICE_ENV_VARS[config.planType][config.tier]] || '',
        yearlyPriceId: process.env[YEARLY_PRICE_ENV_VARS[config.planType][config.tier]] || '',
    })).filter(t => t.priceId !== '');
}

/**
 * Get a single tier definition by tier name and plan type.
 * Returns null if the tier's monthly price ID is not configured.
 */
export function getTierDefinition(tier: PlanTier, planType: PlanType = 'self_service'): TierDefinition | null {
    const envVar = BASE_PRICE_ENV_VARS[planType]?.[tier];
    if (!envVar) return null;

    const priceId = process.env[envVar];
    if (!priceId) return null;

    const config = TIER_CONFIGS.find(c => c.tier === tier && c.planType === planType);
    if (!config) return null;

    return {
        ...config,
        priceId,
        yearlyPriceId: process.env[YEARLY_PRICE_ENV_VARS[planType][tier]] || '',
    };
}

/**
 * Get the Stripe base price ID for a tier, plan type, and interval.
 */
export function getPriceId(tier: PlanTier, planType: PlanType = 'self_service', interval: BillingInterval = 'monthly'): string | null {
    const envVars = interval === 'yearly'
        ? YEARLY_PRICE_ENV_VARS[planType]
        : BASE_PRICE_ENV_VARS[planType];
    if (!envVars?.[tier]) return null;
    return process.env[envVars[tier]] || null;
}

/**
 * Get the Stripe metered price ID for per-minute billing.
 * Single price shared across all tiers and plan types.
 */
export function getMeteredPriceId(): string | null {
    return process.env[METERED_PRICE_ENV_VAR] || null;
}

/**
 * Get the per-minute rate in dollars. Currently flat across all tiers.
 */
export function getPerMinuteRate(): number {
    return PLATFORM_PER_MINUTE_RATE;
}

/** Synthetic price ID assigned to beta trial agencies for full Agency-tier access */
export const BETA_PRICE_ID = 'beta_agency';

/**
 * Reverse-lookup: map a Stripe price_id back to tier + plan type.
 * Checks new env vars first, then legacy env vars for backward compatibility.
 */
export function getTierFromPriceId(priceId: string): { tier: PlanTier; planType: PlanType } | null {
    if (!priceId) return null;

    // Beta trial agencies get full Agency-tier access
    if (priceId === BETA_PRICE_ID) {
        return { tier: 'agency', planType: 'self_service' };
    }

    // Check new env vars (monthly + yearly)
    for (const planType of ['self_service', 'managed'] as PlanType[]) {
        for (const tier of ['starter', 'growth', 'agency'] as PlanTier[]) {
            const monthlyVar = BASE_PRICE_ENV_VARS[planType][tier];
            const yearlyVar = YEARLY_PRICE_ENV_VARS[planType][tier];
            if (process.env[monthlyVar] === priceId || process.env[yearlyVar] === priceId) {
                return { tier, planType };
            }
        }
    }

    // Legacy backward compatibility
    for (const [envVar, mapping] of Object.entries(LEGACY_PRICE_ENV_VARS)) {
        if (process.env[envVar] === priceId) {
            return mapping;
        }
    }

    // Final fallback: legacy single STRIPE_PRICE_ID maps to growth/self_service
    if (process.env.STRIPE_PRICE_ID === priceId) {
        return { tier: 'growth', planType: 'self_service' };
    }

    return null;
}

/**
 * Check if a price ID is a yearly plan.
 */
export function isYearlyPriceId(priceId: string): boolean {
    if (!priceId) return false;
    for (const planType of ['self_service', 'managed'] as PlanType[]) {
        for (const tier of ['starter', 'growth', 'agency'] as PlanTier[]) {
            if (process.env[YEARLY_PRICE_ENV_VARS[planType][tier]] === priceId) return true;
        }
    }
    // Check legacy yearly vars
    for (const envVar of ['STRIPE_PRICE_ID_STARTER_YEARLY', 'STRIPE_PRICE_ID_GROWTH_YEARLY', 'STRIPE_PRICE_ID_SCALE_YEARLY']) {
        if (process.env[envVar] === priceId) return true;
    }
    return false;
}

/**
 * Check whether the given usage exceeds a tier's limits.
 */
export function checkTierLimits(
    tier: PlanTier,
    planType: PlanType = 'self_service',
    usage: { agentCount: number; callMinutes: number; clientCount: number }
): { exceeded: boolean; details: string[] } {
    const def = getTierDefinition(tier, planType);
    if (!def) return { exceeded: true, details: ['Tier not configured — limits cannot be verified'] };

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
 * Get the tier config for display purposes (no priceId needed).
 * Works even when env vars aren't set (useful for client-side).
 */
export function getTierConfig(tier: PlanTier, planType: PlanType = 'self_service'): TierConfig | null {
    return TIER_CONFIGS.find(c => c.tier === tier && c.planType === planType) || null;
}

/**
 * Get all tier configs for display purposes (no priceId needed).
 */
export function getAllTierConfigs(planType?: PlanType): TierConfig[] {
    if (planType) {
        return TIER_CONFIGS.filter(c => c.planType === planType);
    }
    return [...TIER_CONFIGS];
}
