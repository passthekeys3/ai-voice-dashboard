/**
 * Shared lookup for trigger webhooks: resolve an agency by integration ID.
 *
 * Searches agency-level integrations first, then falls back to client-level.
 * When matched on a client, deep-merges the client's integration config
 * over the agency's so trigger_config and calling_window are preserved.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgencyTriggerRow } from '@/types';

const AGENCY_SELECT = 'id, integrations, calling_window, retell_api_key, vapi_api_key, bland_api_key, subscription_price_id, subscription_status, beta_ends_at';

export type ResolveTriggerResult =
    | { ok: true; agency: AgencyTriggerRow }
    | { ok: false; status: number; error: string };

/**
 * Look up the agency that owns a given integration ID (e.g., GHL location_id, HubSpot portal_id).
 *
 * @param provider   - Integration key ('ghl' | 'hubspot')
 * @param field      - The field to match on ('location_id' | 'portal_id')
 * @param value      - The value to match
 */
export async function resolveTriggerAgency(
    supabase: SupabaseClient,
    provider: string,
    field: string,
    value: string,
): Promise<ResolveTriggerResult> {
    // 1. Check agency-level integrations
    const { data: agencies, error: agencyError } = await supabase
        .from('agencies')
        .select(AGENCY_SELECT)
        .filter(`integrations->${provider}->>${field}`, 'eq', value);

    if (!agencyError && agencies && agencies.length === 1) {
        return { ok: true, agency: agencies[0] as AgencyTriggerRow };
    }

    if (!agencyError && agencies && agencies.length > 1) {
        console.error(`SECURITY: Multiple agencies matched ${provider} ${field} ${value}: ${agencies.map(a => a.id).join(', ')}`);
        return { ok: false, status: 500, error: 'Configuration error — contact support' };
    }

    // 2. No agency match — check client-level integrations
    const { data: clients } = await supabase
        .from('clients')
        .select('id, agency_id, integrations')
        .filter(`integrations->${provider}->>${field}`, 'eq', value);

    if (!clients || clients.length === 0) {
        return { ok: false, status: 404, error: `No agency or client found for this ${field}` };
    }

    if (clients.length > 1) {
        console.error(`SECURITY: Multiple clients matched ${provider} ${field} ${value}: ${clients.map((c: { id: string }) => c.id).join(', ')}`);
        return { ok: false, status: 500, error: 'Configuration error — contact support' };
    }

    // 3. Fetch the parent agency
    const { data: parentAgency } = await supabase
        .from('agencies')
        .select(AGENCY_SELECT)
        .eq('id', clients[0].agency_id)
        .single();

    if (!parentAgency) {
        return { ok: false, status: 404, error: 'Parent agency not found' };
    }

    // 4. Deep-merge client's provider config over agency (preserves trigger_config, calling_window)
    const agencyIntegrations = ((parentAgency as AgencyTriggerRow).integrations || {}) as Record<string, unknown>;
    const existingProviderConfig = (agencyIntegrations[provider] as Record<string, unknown>) || {};
    const clientProviderConfig = (clients[0].integrations?.[provider] as Record<string, unknown>) || {};

    const agency: AgencyTriggerRow = {
        ...(parentAgency as AgencyTriggerRow),
        integrations: {
            ...agencyIntegrations,
            [provider]: { ...existingProviderConfig, ...clientProviderConfig },
        },
    };

    return { ok: true, agency };
}
