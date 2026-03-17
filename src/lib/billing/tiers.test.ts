import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('billing/tiers', () => {
    beforeEach(() => {
        vi.resetModules();
        // Set up env vars for price ID resolution
        vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_STARTER_MONTHLY', 'price_ss_starter_mo');
        vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_GROWTH_MONTHLY', 'price_ss_growth_mo');
        vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_AGENCY_MONTHLY', 'price_ss_agency_mo');
        vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_STARTER_YEARLY', 'price_ss_starter_yr');
        vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_GROWTH_YEARLY', 'price_ss_growth_yr');
        vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_AGENCY_YEARLY', 'price_ss_agency_yr');
        vi.stubEnv('STRIPE_PRICE_MANAGED_STARTER_MONTHLY', 'price_mg_starter_mo');
        vi.stubEnv('STRIPE_PRICE_MANAGED_GROWTH_MONTHLY', 'price_mg_growth_mo');
        vi.stubEnv('STRIPE_PRICE_MANAGED_AGENCY_MONTHLY', 'price_mg_agency_mo');
        vi.stubEnv('STRIPE_PRICE_MANAGED_STARTER_YEARLY', 'price_mg_starter_yr');
        vi.stubEnv('STRIPE_PRICE_MANAGED_GROWTH_YEARLY', 'price_mg_growth_yr');
        vi.stubEnv('STRIPE_PRICE_MANAGED_AGENCY_YEARLY', 'price_mg_agency_yr');
        // Legacy env vars
        vi.stubEnv('STRIPE_PRICE_ID_STARTER', 'price_legacy_starter');
        vi.stubEnv('STRIPE_PRICE_ID_GROWTH', 'price_legacy_growth');
        vi.stubEnv('STRIPE_PRICE_ID_SCALE', 'price_legacy_scale');
        vi.stubEnv('STRIPE_PRICE_ID_STARTER_YEARLY', 'price_legacy_starter_yr');
        vi.stubEnv('STRIPE_PRICE_ID_GROWTH_YEARLY', 'price_legacy_growth_yr');
        vi.stubEnv('STRIPE_PRICE_ID_SCALE_YEARLY', 'price_legacy_scale_yr');
        vi.stubEnv('STRIPE_PRICE_METERED_MINUTE', 'price_metered');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    // ---- hasFeature ----

    describe('hasFeature', () => {
        it('starter has no features', async () => {
            const { hasFeature } = await import('./tiers');
            expect(hasFeature('starter', 'crm_integrations')).toBe(false);
            expect(hasFeature('starter', 'white_label')).toBe(false);
            expect(hasFeature('starter', 'api_access')).toBe(false);
            expect(hasFeature('starter', 'agent_testing')).toBe(false);
        });

        it('growth has CRM, white-label, stripe connect, experiments', async () => {
            const { hasFeature } = await import('./tiers');
            expect(hasFeature('growth', 'crm_integrations')).toBe(true);
            expect(hasFeature('growth', 'white_label')).toBe(true);
            expect(hasFeature('growth', 'stripe_connect')).toBe(true);
            expect(hasFeature('growth', 'experiments')).toBe(true);
        });

        it('growth does NOT have agency-only features', async () => {
            const { hasFeature } = await import('./tiers');
            expect(hasFeature('growth', 'agent_testing')).toBe(false);
            expect(hasFeature('growth', 'api_access')).toBe(false);
        });

        it('agency has all features', async () => {
            const { hasFeature } = await import('./tiers');
            expect(hasFeature('agency', 'crm_integrations')).toBe(true);
            expect(hasFeature('agency', 'white_label')).toBe(true);
            expect(hasFeature('agency', 'stripe_connect')).toBe(true);
            expect(hasFeature('agency', 'experiments')).toBe(true);
            expect(hasFeature('agency', 'agent_testing')).toBe(true);
            expect(hasFeature('agency', 'api_access')).toBe(true);
        });
    });

    // ---- minimumTierForFeature ----

    describe('minimumTierForFeature', () => {
        it('returns growth for CRM integrations', async () => {
            const { minimumTierForFeature } = await import('./tiers');
            expect(minimumTierForFeature('crm_integrations')).toBe('growth');
        });

        it('returns agency for api_access', async () => {
            const { minimumTierForFeature } = await import('./tiers');
            expect(minimumTierForFeature('api_access')).toBe('agency');
        });

        it('returns agency for agent_testing', async () => {
            const { minimumTierForFeature } = await import('./tiers');
            expect(minimumTierForFeature('agent_testing')).toBe('agency');
        });
    });

    // ---- tierGateError ----

    describe('tierGateError', () => {
        it('generates correct error for growth-tier feature', async () => {
            const { tierGateError } = await import('./tiers');
            const msg = tierGateError('crm_integrations');
            expect(msg).toContain('CRM Integrations');
            expect(msg).toContain('Growth');
            expect(msg).toContain('upgrade');
        });

        it('generates correct error for agency-tier feature', async () => {
            const { tierGateError } = await import('./tiers');
            const msg = tierGateError('api_access');
            expect(msg).toContain('API Access');
            expect(msg).toContain('Agency');
        });
    });

    // ---- checkFeatureAccess ----

    describe('checkFeatureAccess', () => {
        it('grants access with active subscription on correct tier', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const result = checkFeatureAccess('price_ss_growth_mo', 'active', 'crm_integrations');
            expect(result).toBeNull();
        });

        it('grants access with trialing status', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const result = checkFeatureAccess('price_ss_agency_mo', 'trialing', 'api_access');
            expect(result).toBeNull();
        });

        it('denies access when tier is too low', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const result = checkFeatureAccess('price_ss_starter_mo', 'active', 'crm_integrations');
            expect(result).not.toBeNull();
            expect(result).toContain('Growth');
        });

        it('denies access when subscription is not active', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const result = checkFeatureAccess('price_ss_agency_mo', 'past_due', 'api_access');
            expect(result).not.toBeNull();
            expect(result).toContain('not active');
        });

        it('denies access when subscription is canceled', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const result = checkFeatureAccess('price_ss_agency_mo', 'canceled', 'api_access');
            expect(result).not.toBeNull();
        });

        it('denies access with no price ID', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const result = checkFeatureAccess(null, 'active', 'crm_integrations');
            expect(result).not.toBeNull();
        });

        it('grants access for beta agency with valid beta period', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const future = new Date(Date.now() + 86400000).toISOString();
            const result = checkFeatureAccess('beta_agency', 'active', 'api_access', future);
            expect(result).toBeNull();
        });

        it('denies access for expired beta', async () => {
            const { checkFeatureAccess } = await import('./tiers');
            const past = new Date(Date.now() - 86400000).toISOString();
            const result = checkFeatureAccess('beta_agency', 'active', 'api_access', past);
            expect(result).not.toBeNull();
            expect(result).toContain('beta trial has expired');
        });
    });

    // ---- getTierFromPriceId ----

    describe('getTierFromPriceId', () => {
        it('maps beta_agency to agency/self_service', async () => {
            const { getTierFromPriceId } = await import('./tiers');
            expect(getTierFromPriceId('beta_agency')).toEqual({ tier: 'agency', planType: 'self_service' });
        });

        it('maps monthly self-service price IDs', async () => {
            const { getTierFromPriceId } = await import('./tiers');
            expect(getTierFromPriceId('price_ss_starter_mo')).toEqual({ tier: 'starter', planType: 'self_service' });
            expect(getTierFromPriceId('price_ss_growth_mo')).toEqual({ tier: 'growth', planType: 'self_service' });
            expect(getTierFromPriceId('price_ss_agency_mo')).toEqual({ tier: 'agency', planType: 'self_service' });
        });

        it('maps yearly managed price IDs', async () => {
            const { getTierFromPriceId } = await import('./tiers');
            expect(getTierFromPriceId('price_mg_agency_yr')).toEqual({ tier: 'agency', planType: 'managed' });
        });

        it('maps legacy price IDs', async () => {
            const { getTierFromPriceId } = await import('./tiers');
            expect(getTierFromPriceId('price_legacy_starter')).toEqual({ tier: 'starter', planType: 'self_service' });
            expect(getTierFromPriceId('price_legacy_scale')).toEqual({ tier: 'agency', planType: 'self_service' });
        });

        it('returns null for unknown price ID', async () => {
            const { getTierFromPriceId } = await import('./tiers');
            expect(getTierFromPriceId('price_unknown')).toBeNull();
        });

        it('returns null for empty string', async () => {
            const { getTierFromPriceId } = await import('./tiers');
            expect(getTierFromPriceId('')).toBeNull();
        });
    });

    // ---- isYearlyPriceId ----

    describe('isYearlyPriceId', () => {
        it('identifies yearly price IDs', async () => {
            const { isYearlyPriceId } = await import('./tiers');
            expect(isYearlyPriceId('price_ss_starter_yr')).toBe(true);
            expect(isYearlyPriceId('price_mg_agency_yr')).toBe(true);
        });

        it('identifies monthly price IDs as not yearly', async () => {
            const { isYearlyPriceId } = await import('./tiers');
            expect(isYearlyPriceId('price_ss_starter_mo')).toBe(false);
        });

        it('identifies legacy yearly price IDs', async () => {
            const { isYearlyPriceId } = await import('./tiers');
            expect(isYearlyPriceId('price_legacy_starter_yr')).toBe(true);
            expect(isYearlyPriceId('price_legacy_scale_yr')).toBe(true);
        });

        it('returns false for empty string', async () => {
            const { isYearlyPriceId } = await import('./tiers');
            expect(isYearlyPriceId('')).toBe(false);
        });
    });

    // ---- checkTierLimits ----

    describe('checkTierLimits', () => {
        it('passes when usage is under limits', async () => {
            const { checkTierLimits } = await import('./tiers');
            const result = checkTierLimits('starter', 'self_service', {
                agentCount: 1,
                callMinutes: 100,
                clientCount: 2,
            });
            expect(result.exceeded).toBe(false);
            expect(result.details).toHaveLength(0);
        });

        it('fails when client count exceeds limit', async () => {
            const { checkTierLimits } = await import('./tiers');
            const result = checkTierLimits('starter', 'self_service', {
                agentCount: 1,
                callMinutes: 100,
                clientCount: 5, // starter limit is 3
            });
            expect(result.exceeded).toBe(true);
            expect(result.details).toHaveLength(1);
            expect(result.details[0]).toContain('Client limit exceeded');
        });

        it('never exceeds Infinity limits (agents, call minutes)', async () => {
            const { checkTierLimits } = await import('./tiers');
            const result = checkTierLimits('agency', 'self_service', {
                agentCount: 999999,
                callMinutes: 999999,
                clientCount: 1,
            });
            expect(result.exceeded).toBe(false);
        });

        it('reports multiple exceeded limits', async () => {
            const { checkTierLimits } = await import('./tiers');
            const result = checkTierLimits('starter', 'self_service', {
                agentCount: 1,
                callMinutes: 100,
                clientCount: 100,
            });
            expect(result.exceeded).toBe(true);
            expect(result.details.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ---- getTierDefinitions / getTierDefinition ----

    describe('getTierDefinitions', () => {
        it('returns all tiers when no filter', async () => {
            const { getTierDefinitions } = await import('./tiers');
            const defs = getTierDefinitions();
            expect(defs.length).toBe(6); // 3 self-service + 3 managed
        });

        it('filters by plan type', async () => {
            const { getTierDefinitions } = await import('./tiers');
            const ss = getTierDefinitions('self_service');
            expect(ss.every(d => d.planType === 'self_service')).toBe(true);
            expect(ss.length).toBe(3);
        });

        it('includes resolved price IDs from env vars', async () => {
            const { getTierDefinitions } = await import('./tiers');
            const defs = getTierDefinitions('self_service');
            const starter = defs.find(d => d.tier === 'starter');
            expect(starter?.priceId).toBe('price_ss_starter_mo');
            expect(starter?.yearlyPriceId).toBe('price_ss_starter_yr');
        });
    });

    describe('getTierDefinition', () => {
        it('returns a single tier definition', async () => {
            const { getTierDefinition } = await import('./tiers');
            const def = getTierDefinition('growth', 'self_service');
            expect(def).not.toBeNull();
            expect(def!.tier).toBe('growth');
            expect(def!.priceId).toBe('price_ss_growth_mo');
        });

        it('returns null when env var not set', async () => {
            vi.stubEnv('STRIPE_PRICE_SELF_SERVICE_STARTER_MONTHLY', '');
            const { getTierDefinition } = await import('./tiers');
            const def = getTierDefinition('starter', 'self_service');
            expect(def).toBeNull();
        });
    });

    // ---- getMeteredPriceId / getPerMinuteRate ----

    describe('getMeteredPriceId', () => {
        it('returns metered price ID from env', async () => {
            const { getMeteredPriceId } = await import('./tiers');
            expect(getMeteredPriceId()).toBe('price_metered');
        });
    });

    describe('getPerMinuteRate', () => {
        it('returns flat rate of 0.15', async () => {
            const { getPerMinuteRate, PLATFORM_PER_MINUTE_RATE } = await import('./tiers');
            expect(getPerMinuteRate()).toBe(0.15);
            expect(PLATFORM_PER_MINUTE_RATE).toBe(0.15);
        });
    });
});
