/**
 * Shared OAuth helpers for CRM integrations (GHL, HubSpot, etc.)
 *
 * Extracts common patterns: state signing/verification, client validation,
 * and token storage routing (agency vs client level).
 */

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── State signing / verification ──────────────────────────────── */

interface StatePayload {
    agencyId: string;
    clientId?: string;
    timestamp: number;
}

/**
 * Create an HMAC-signed, base64-encoded state parameter for OAuth CSRF protection.
 * Includes agencyId, optional clientId, and a timestamp.
 */
export function signOAuthState(
    payload: { agencyId: string; clientId?: string | null },
    secret: string,
): string {
    const statePayload = JSON.stringify({
        agencyId: payload.agencyId,
        ...(payload.clientId ? { clientId: payload.clientId } : {}),
        timestamp: Date.now(),
    });
    const signature = crypto
        .createHmac('sha256', secret)
        .update(statePayload)
        .digest('hex');
    return Buffer.from(`${statePayload}.${signature}`).toString('base64');
}

/**
 * Verify and decode an HMAC-signed OAuth state parameter.
 * Returns the decoded payload or null if verification fails.
 */
export function verifyOAuthState(
    state: string,
    secret: string,
): StatePayload | null {
    try {
        const decoded = Buffer.from(state, 'base64').toString();
        const lastDotIndex = decoded.lastIndexOf('.');
        if (lastDotIndex === -1) return null;

        const statePayload = decoded.slice(0, lastDotIndex);
        const stateSignature = decoded.slice(lastDotIndex + 1);

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(statePayload)
            .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSignature))) {
            return null;
        }

        return JSON.parse(statePayload) as StatePayload;
    } catch {
        return null;
    }
}

/**
 * Extract the redirect base path from a state parameter without full HMAC verification.
 * Used for error redirects when the OAuth provider returns an error alongside the state.
 * Returns '/settings' if state cannot be parsed or has no clientId.
 */
export function extractRedirectBase(state: string | null): string {
    if (!state) return '/settings';
    try {
        const decoded = Buffer.from(state, 'base64').toString();
        const lastDotIndex = decoded.lastIndexOf('.');
        if (lastDotIndex === -1) return '/settings';
        const payload = JSON.parse(decoded.slice(0, lastDotIndex));
        return payload.clientId ? `/clients/${payload.clientId}` : '/settings';
    } catch {
        return '/settings';
    }
}

/* ── Client ownership validation ───────────────────────────────── */

/**
 * Validate that a client belongs to the given agency.
 * Returns true if valid, false if not found or wrong agency.
 */
export async function validateClientOwnership(
    supabase: SupabaseClient,
    clientId: string,
    agencyId: string,
): Promise<boolean> {
    const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .single();
    return !!data;
}

/* ── Token storage routing ─────────────────────────────────────── */

/**
 * Store OAuth tokens in either the client or agency integrations column.
 * Uses deep merge to preserve existing config (trigger_config, calling_window, etc.).
 *
 * @returns Error message string if update failed, null on success.
 */
export async function storeOAuthTokens(
    supabase: SupabaseClient,
    provider: string,
    agencyId: string,
    clientId: string | undefined,
    tokenData: Record<string, unknown>,
): Promise<string | null> {
    if (clientId) {
        // Per-client OAuth — store in clients.integrations
        const { data: client } = await supabase
            .from('clients')
            .select('integrations')
            .eq('id', clientId)
            .eq('agency_id', agencyId)
            .single();

        if (!client) return 'Client not found';

        const clientIntegrations = (client.integrations as Record<string, unknown>) || {};
        const updatedIntegrations = {
            ...clientIntegrations,
            [provider]: {
                ...(clientIntegrations[provider] as Record<string, unknown> || {}),
                ...tokenData,
            },
        };

        const { error } = await supabase
            .from('clients')
            .update({
                integrations: updatedIntegrations,
                updated_at: new Date().toISOString(),
            })
            .eq('id', clientId)
            .eq('agency_id', agencyId);

        return error ? `Failed to save tokens: ${error.code}` : null;
    } else {
        // Agency-level OAuth — store in agencies.integrations
        const { data: agency } = await supabase
            .from('agencies')
            .select('integrations')
            .eq('id', agencyId)
            .single();

        const agencyIntegrations = (agency?.integrations as Record<string, unknown>) || {};
        const existingProviderConfig = (agencyIntegrations[provider] as Record<string, unknown>) || {};
        const updatedIntegrations = {
            ...agencyIntegrations,
            [provider]: {
                ...existingProviderConfig,
                ...tokenData,
            },
        };

        const { error } = await supabase
            .from('agencies')
            .update({
                integrations: updatedIntegrations,
                updated_at: new Date().toISOString(),
            })
            .eq('id', agencyId);

        return error ? `Failed to save tokens: ${error.code}` : null;
    }
}
