/**
 * Shared integration validation logic.
 * Used by both /api/settings (agency) and /api/clients/[id]/integrations (client).
 */

const API_KEY_MAX_LENGTH = 256;
const API_KEY_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;
const TOKEN_MAX_LENGTH = 2048;

/** Only these top-level integration keys are accepted. */
export const ALLOWED_INTEGRATION_KEYS = new Set([
    'ghl', 'hubspot', 'google_calendar', 'slack', 'calendly', 'api',
]);

/** Keys that should never appear in user-supplied objects (prototype pollution). */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Recursively deep-merge source into target. Arrays are replaced, not merged. */
export function deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
): Record<string, unknown> {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (DANGEROUS_KEYS.has(key)) continue;

        if (
            typeof value === 'object' && value !== null && !Array.isArray(value) &&
            typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])
        ) {
            result[key] = deepMerge(
                target[key] as Record<string, unknown>,
                value as Record<string, unknown>,
            );
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Sanitize integration updates by stripping unknown top-level keys.
 */
export function sanitizeIntegrations(
    integrations: Record<string, unknown>,
): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(integrations)) {
        if (ALLOWED_INTEGRATION_KEYS.has(key)) {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Validate integration updates. Returns null on success or an error message on failure.
 */
export function validateIntegrationUpdates(
    integrations: Record<string, unknown>,
): string | null {
    // Validate GHL integration settings
    if (integrations.ghl) {
        const ghl = integrations.ghl as Record<string, unknown>;
        if (ghl.api_key) {
            if (typeof ghl.api_key !== 'string' || (ghl.api_key as string).length > API_KEY_MAX_LENGTH) {
                return 'Invalid GHL API key: too long';
            }
            if (!API_KEY_PATTERN.test(ghl.api_key as string)) {
                return 'Invalid GHL API key format';
            }
        }
        if (ghl.location_id) {
            if (typeof ghl.location_id !== 'string' || (ghl.location_id as string).length > 100) {
                return 'Invalid GHL Location ID';
            }
        }
        if (ghl.access_token !== undefined) {
            if (typeof ghl.access_token !== 'string' || (ghl.access_token as string).length > TOKEN_MAX_LENGTH) {
                return 'Invalid GHL access token';
            }
        }
        if (ghl.refresh_token !== undefined) {
            if (typeof ghl.refresh_token !== 'string' || (ghl.refresh_token as string).length > TOKEN_MAX_LENGTH) {
                return 'Invalid GHL refresh token';
            }
        }
        if (ghl.auth_method !== undefined) {
            if (ghl.auth_method !== 'api_key' && ghl.auth_method !== 'oauth') {
                return 'Invalid GHL auth method';
            }
        }
        if (ghl.oauth_location_id !== undefined) {
            if (typeof ghl.oauth_location_id !== 'string' || (ghl.oauth_location_id as string).length > 100) {
                return 'Invalid GHL OAuth location ID';
            }
        }
        if (ghl.expires_at !== undefined) {
            if (typeof ghl.expires_at !== 'number' || (ghl.expires_at as number) < 0) {
                return 'Invalid GHL token expiry';
            }
        }
        if (ghl.enabled !== undefined && typeof ghl.enabled !== 'boolean') {
            return 'GHL enabled must be a boolean';
        }
    }

    // Validate HubSpot integration settings
    if (integrations.hubspot) {
        const hubspot = integrations.hubspot as Record<string, unknown>;
        const HS_TOKEN_MAX = 500;
        if (hubspot.access_token) {
            if (typeof hubspot.access_token !== 'string' || (hubspot.access_token as string).length > HS_TOKEN_MAX) {
                return 'Invalid HubSpot access token';
            }
        }
        if (hubspot.refresh_token) {
            if (typeof hubspot.refresh_token !== 'string' || (hubspot.refresh_token as string).length > HS_TOKEN_MAX) {
                return 'Invalid HubSpot refresh token';
            }
        }
        if (hubspot.enabled !== undefined && typeof hubspot.enabled !== 'boolean') {
            return 'HubSpot enabled must be a boolean';
        }
    }

    // Validate Google Calendar integration settings
    if (integrations.google_calendar) {
        const gcal = integrations.google_calendar as Record<string, unknown>;
        if (gcal.access_token !== undefined) {
            if (typeof gcal.access_token !== 'string' || (gcal.access_token as string).length > TOKEN_MAX_LENGTH) {
                return 'Invalid Google Calendar access token';
            }
        }
        if (gcal.refresh_token !== undefined) {
            if (typeof gcal.refresh_token !== 'string' || (gcal.refresh_token as string).length > TOKEN_MAX_LENGTH) {
                return 'Invalid Google Calendar refresh token';
            }
        }
        if (gcal.enabled !== undefined && typeof gcal.enabled !== 'boolean') {
            return 'Google Calendar enabled must be a boolean';
        }
        if (gcal.default_calendar_id !== undefined) {
            if (typeof gcal.default_calendar_id !== 'string' || (gcal.default_calendar_id as string).length > 200) {
                return 'Invalid calendar ID';
            }
        }
    }

    // Validate Slack integration settings
    if (integrations.slack) {
        const slack = integrations.slack as Record<string, unknown>;
        if (slack.webhook_url !== undefined && slack.webhook_url !== null && slack.webhook_url !== '') {
            if (typeof slack.webhook_url !== 'string') {
                return 'Slack webhook URL must be a string';
            }
            const url = slack.webhook_url as string;
            if (!url.startsWith('https://hooks.slack.com/') && !url.startsWith('https://hooks.slack-gov.com/')) {
                return 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/';
            }
            if (url.length > 500) {
                return 'Slack webhook URL is too long';
            }
        }
        if (slack.enabled !== undefined && typeof slack.enabled !== 'boolean') {
            return 'Slack enabled must be a boolean';
        }
        if (slack.channel_name !== undefined && slack.channel_name !== null) {
            if (typeof slack.channel_name !== 'string' || (slack.channel_name as string).length > 100) {
                return 'Invalid Slack channel name';
            }
        }
    }

    // Validate Calendly integration settings
    if (integrations.calendly) {
        const calendly = integrations.calendly as Record<string, unknown>;
        if (calendly.api_token !== undefined && calendly.api_token !== null && calendly.api_token !== '') {
            if (typeof calendly.api_token !== 'string' || (calendly.api_token as string).length > 500) {
                return 'Invalid Calendly API token';
            }
        }
        if (calendly.enabled !== undefined && typeof calendly.enabled !== 'boolean') {
            return 'Calendly enabled must be a boolean';
        }
        if (calendly.user_uri !== undefined && calendly.user_uri !== null) {
            if (typeof calendly.user_uri !== 'string' || (calendly.user_uri as string).length > 500) {
                return 'Invalid Calendly user URI';
            }
        }
        if (calendly.default_event_type_uri !== undefined && calendly.default_event_type_uri !== null) {
            if (typeof calendly.default_event_type_uri !== 'string' || (calendly.default_event_type_uri as string).length > 500) {
                return 'Invalid Calendly event type URI';
            }
        }
    }

    // Validate API trigger settings
    if (integrations.api) {
        const api = integrations.api as Record<string, unknown>;
        if (api.api_key !== undefined && api.api_key !== null) {
            if (typeof api.api_key !== 'string' || !/^pdy_sk_[a-f0-9]{64}$/.test(api.api_key as string)) {
                return 'Invalid API trigger key format';
            }
        }
        if (api.enabled !== undefined && typeof api.enabled !== 'boolean') {
            return 'API trigger enabled must be a boolean';
        }
        if (api.default_agent_id !== undefined && api.default_agent_id !== null) {
            if (typeof api.default_agent_id !== 'string') {
                return 'Invalid default agent ID';
            }
        }
    }

    return null;
}

/**
 * Mask sensitive fields in an integrations object for safe client display.
 */
export function maskIntegrationSecrets(
    integrations: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
    if (!integrations) return null;

    const mask = (val: unknown): unknown => {
        if (typeof val === 'string' && val.length > 4) {
            return '...' + val.slice(-4);
        }
        return val;
    };

    const result = { ...integrations };

    if (result.ghl && typeof result.ghl === 'object') {
        const ghl = { ...(result.ghl as Record<string, unknown>) };
        if (ghl.api_key) ghl.api_key = mask(ghl.api_key);
        if (ghl.access_token) ghl.access_token = mask(ghl.access_token);
        if (ghl.refresh_token) ghl.refresh_token = mask(ghl.refresh_token);
        result.ghl = ghl;
    }

    if (result.hubspot && typeof result.hubspot === 'object') {
        const hs = { ...(result.hubspot as Record<string, unknown>) };
        if (hs.access_token) hs.access_token = mask(hs.access_token);
        if (hs.refresh_token) hs.refresh_token = mask(hs.refresh_token);
        result.hubspot = hs;
    }

    if (result.google_calendar && typeof result.google_calendar === 'object') {
        const gc = { ...(result.google_calendar as Record<string, unknown>) };
        if (gc.access_token) gc.access_token = mask(gc.access_token);
        if (gc.refresh_token) gc.refresh_token = mask(gc.refresh_token);
        result.google_calendar = gc;
    }

    if (result.api && typeof result.api === 'object') {
        const api = { ...(result.api as Record<string, unknown>) };
        if (api.api_key) api.api_key = mask(api.api_key);
        result.api = api;
    }

    if (result.slack && typeof result.slack === 'object') {
        const slack = { ...(result.slack as Record<string, unknown>) };
        if (slack.webhook_url) slack.webhook_url = mask(slack.webhook_url);
        result.slack = slack;
    }

    if (result.calendly && typeof result.calendly === 'object') {
        const cal = { ...(result.calendly as Record<string, unknown>) };
        if (cal.api_token) cal.api_token = mask(cal.api_token);
        result.calendly = cal;
    }

    return result;
}
