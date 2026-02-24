/**
 * Per-client integration resolution.
 *
 * Follows the same override pattern as resolve-keys.ts for voice provider API keys:
 * client config > agency config > undefined.
 *
 * Resolution is per-integration-KEY (ghl, hubspot, etc.), not per-field.
 * If a client has ghl config, the entire ghl block comes from the client.
 * This prevents confusing partial merges of OAuth tokens + API keys.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgencyIntegrations } from '@/types';
import { ALLOWED_INTEGRATION_KEYS } from './validate-integrations';

/** Derived from the canonical ALLOWED_INTEGRATION_KEYS Set in validate-integrations.ts */
const INTEGRATION_KEYS = [...ALLOWED_INTEGRATION_KEYS] as (keyof AgencyIntegrations)[];

export type IntegrationSource = 'client' | 'agency' | null;

export interface ResolvedIntegrations {
    integrations: AgencyIntegrations;
    /** Per-key source tracking for debugging, UI display, and token refresh write-back */
    source: Partial<Record<keyof AgencyIntegrations, IntegrationSource>>;
}

/**
 * Resolve integration config with per-client override.
 * Each top-level integration key is resolved independently:
 * client config → agency config → undefined.
 */
export async function resolveIntegrations(
    supabase: SupabaseClient,
    agencyId: string,
    clientId?: string | null,
): Promise<ResolvedIntegrations> {
    // Fetch agency integrations
    const { data: agency } = await supabase
        .from('agencies')
        .select('integrations')
        .eq('id', agencyId)
        .single();

    const agencyIntegrations = (agency?.integrations as AgencyIntegrations) || {};

    // No client → agency-only
    if (!clientId) {
        const source: Partial<Record<keyof AgencyIntegrations, IntegrationSource>> = {};
        for (const key of INTEGRATION_KEYS) {
            if (agencyIntegrations[key]) {
                source[key] = 'agency';
            }
        }
        return { integrations: agencyIntegrations, source };
    }

    // Fetch client integrations
    const { data: client } = await supabase
        .from('clients')
        .select('integrations')
        .eq('id', clientId)
        .eq('agency_id', agencyId) // Cross-tenant protection
        .single();

    const clientIntegrations = (client?.integrations as AgencyIntegrations) || {};

    // Per-key resolution: client overrides entire integration block
    const resolved: AgencyIntegrations = {};
    const source: Partial<Record<keyof AgencyIntegrations, IntegrationSource>> = {};

    for (const key of INTEGRATION_KEYS) {
        if (clientIntegrations[key]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (resolved as any)[key] = clientIntegrations[key];
            source[key] = 'client';
        } else if (agencyIntegrations[key]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (resolved as any)[key] = agencyIntegrations[key];
            source[key] = 'agency';
        } else {
            source[key] = null;
        }
    }

    return { integrations: resolved, source };
}

/**
 * Get only the agency integrations (without client resolution).
 * Use when client context is not available or not needed.
 */
export async function getAgencyIntegrations(
    supabase: SupabaseClient,
    agencyId: string,
): Promise<AgencyIntegrations> {
    const { data: agency } = await supabase
        .from('agencies')
        .select('integrations')
        .eq('id', agencyId)
        .single();

    return (agency?.integrations as AgencyIntegrations) || {};
}

/**
 * Create a callback for writing refreshed OAuth tokens back to the correct table.
 *
 * When integration config came from a client override (source === 'client'),
 * the refreshed token must be written back to `clients.integrations`.
 * When it came from the agency (source === 'agency'), write to `agencies.integrations`.
 *
 * This fetches the current integrations from the source table (not the merged view)
 * to avoid accidentally copying client data into the agency table or vice versa.
 */
export function createTokenRefreshCallback(
    supabase: SupabaseClient,
    agencyId: string,
    clientId: string | null | undefined,
    integrationKey: string,
    source: IntegrationSource,
): (newTokens: { accessToken: string; refreshToken?: string; expiresAt?: number }) => Promise<void> {
    return async (newTokens) => {
        const writeToClient = source === 'client' && !!clientId;

        // Fetch current integrations from the source table (not the resolved merged view)
        const { data: row } = writeToClient
            ? await supabase.from('clients').select('integrations').eq('id', clientId).eq('agency_id', agencyId).single()
            : await supabase.from('agencies').select('integrations').eq('id', agencyId).single();

        const existing = (row?.integrations as Record<string, unknown>) || {};
        const existingKeyConfig = (existing[integrationKey] as Record<string, unknown>) || {};

        const updatedIntegrations = {
            ...existing,
            [integrationKey]: {
                ...existingKeyConfig,
                access_token: newTokens.accessToken,
                ...(newTokens.refreshToken !== undefined ? { refresh_token: newTokens.refreshToken } : {}),
                ...(newTokens.expiresAt !== undefined ? { expires_at: newTokens.expiresAt } : {}),
            },
        };

        if (writeToClient) {
            await supabase.from('clients').update({
                integrations: updatedIntegrations,
                updated_at: new Date().toISOString(),
            }).eq('id', clientId).eq('agency_id', agencyId);
        } else {
            await supabase.from('agencies').update({
                integrations: updatedIntegrations,
                updated_at: new Date().toISOString(),
            }).eq('id', agencyId);
        }
    };
}
