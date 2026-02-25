/**
 * Per-client voice provider API key resolution.
 *
 * When an agent belongs to a client that has their own provider workspace,
 * the client's API key takes precedence over the agency's key.
 * If the client has no key set (null), the agency key is used as fallback.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VoiceProvider } from '@/types';

export type KeySource = 'client' | 'agency' | 'platform' | null;

export interface ResolvedApiKeys {
    retell_api_key: string | null;
    vapi_api_key: string | null;
    bland_api_key: string | null;
    /** Which source each key came from (useful for billing & debugging) */
    source: {
        retell: KeySource;
        vapi: KeySource;
        bland: KeySource;
    };
}

/**
 * Resolve voice provider API keys with client-level override.
 *
 * Priority: client key > agency key > null
 *
 * @param supabase  Supabase client (user-scoped or service)
 * @param agencyId  The agency ID (always required)
 * @param clientId  Optional client ID — when null/undefined, returns agency keys only
 */
export async function resolveProviderApiKeys(
    supabase: SupabaseClient,
    agencyId: string,
    clientId?: string | null,
): Promise<ResolvedApiKeys> {
    // Always fetch agency keys
    const { data: agency } = await supabase
        .from('agencies')
        .select('retell_api_key, vapi_api_key, bland_api_key')
        .eq('id', agencyId)
        .single();

    // Fetch client keys only when a client is specified
    let clientKeys: {
        retell_api_key?: string | null;
        vapi_api_key?: string | null;
        bland_api_key?: string | null;
    } | null = null;

    if (clientId) {
        const { data: client } = await supabase
            .from('clients')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', clientId)
            .eq('agency_id', agencyId) // Cross-tenant protection
            .single();
        clientKeys = client;
    }

    // Platform keys (env vars) serve as final fallback — metered billing applies when used
    const platformRetellKey = process.env.PLATFORM_RETELL_API_KEY || null;
    const platformVapiKey = process.env.PLATFORM_VAPI_API_KEY || null;
    const platformBlandKey = process.env.PLATFORM_BLAND_API_KEY || null;

    const resolve = (
        clientKey: string | null | undefined,
        agencyKey: string | null | undefined,
        platformKey: string | null,
    ): { key: string | null; source: KeySource } => {
        if (clientKey) return { key: clientKey, source: 'client' };
        if (agencyKey) return { key: agencyKey, source: 'agency' };
        if (platformKey) return { key: platformKey, source: 'platform' };
        return { key: null, source: null };
    };

    const retell = resolve(clientKeys?.retell_api_key, agency?.retell_api_key, platformRetellKey);
    const vapi = resolve(clientKeys?.vapi_api_key, agency?.vapi_api_key, platformVapiKey);
    const bland = resolve(clientKeys?.bland_api_key, agency?.bland_api_key, platformBlandKey);

    return {
        retell_api_key: retell.key,
        vapi_api_key: vapi.key,
        bland_api_key: bland.key,
        source: {
            retell: retell.source,
            vapi: vapi.source,
            bland: bland.source,
        },
    };
}

/**
 * Get a single provider's key from resolved keys.
 */
export function getProviderKey(
    keys: ResolvedApiKeys,
    provider: VoiceProvider,
): string | null {
    switch (provider) {
        case 'retell': return keys.retell_api_key;
        case 'vapi': return keys.vapi_api_key;
        case 'bland': return keys.bland_api_key;
    }
}

/**
 * Auto-select the best available provider from resolved keys.
 * Priority: Retell → Vapi → Bland (same as existing pattern).
 */
export function autoSelectProvider(
    keys: ResolvedApiKeys,
): { provider: VoiceProvider; apiKey: string } | null {
    if (keys.retell_api_key) return { provider: 'retell', apiKey: keys.retell_api_key };
    if (keys.vapi_api_key) return { provider: 'vapi', apiKey: keys.vapi_api_key };
    if (keys.bland_api_key) return { provider: 'bland', apiKey: keys.bland_api_key };
    return null;
}
