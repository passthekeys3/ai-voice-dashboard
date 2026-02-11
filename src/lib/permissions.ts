import type { Agency, Client, ClientPermissions, AuthUser } from '@/types';
import { DEFAULT_CLIENT_PERMISSIONS } from '@/types/database';

/**
 * Resolve the effective permissions for a client.
 * Uses client-specific overrides if set, otherwise falls back to agency defaults.
 * Merges with DEFAULT_CLIENT_PERMISSIONS to ensure new permission keys always exist
 * (backward compatibility for stored JSON missing newer fields).
 */
export function getClientPermissions(
    client: Client | undefined,
    agency: Agency
): ClientPermissions {
    const base = client?.permissions
        ?? agency.default_client_permissions
        ?? DEFAULT_CLIENT_PERMISSIONS;

    return { ...DEFAULT_CLIENT_PERMISSIONS, ...base };
}

/**
 * Get permissions for the current user.
 * Agency users have full access, client users have restricted access.
 */
export function getUserPermissions(user: AuthUser): ClientPermissions {
    // Agency admins/members have full access
    if (['agency_admin', 'agency_member'].includes(user.profile.role)) {
        return {
            show_costs: true,
            show_transcripts: true,
            show_analytics: true,
            allow_playback: true,
            can_edit_agents: true,
            can_create_agents: true,
            can_export_calls: true,
        };
    }

    // Client users get their client's permissions
    return getClientPermissions(user.client, user.agency);
}

/**
 * Check if user can see call costs
 */
export function canSeeCosts(user: AuthUser): boolean {
    return getUserPermissions(user).show_costs;
}

/**
 * Check if user can see transcripts
 */
export function canSeeTranscripts(user: AuthUser): boolean {
    return getUserPermissions(user).show_transcripts;
}

/**
 * Check if user can see analytics
 */
export function canSeeAnalytics(user: AuthUser): boolean {
    return getUserPermissions(user).show_analytics;
}

/**
 * Check if user can play call audio
 */
export function canPlayAudio(user: AuthUser): boolean {
    return getUserPermissions(user).allow_playback;
}

/**
 * Check if user can edit agent settings
 */
export function canEditAgents(user: AuthUser): boolean {
    return getUserPermissions(user).can_edit_agents;
}

/**
 * Check if user can create new agents
 */
export function canCreateAgents(user: AuthUser): boolean {
    return getUserPermissions(user).can_create_agents;
}

/**
 * Check if user can export call data
 */
export function canExportCalls(user: AuthUser): boolean {
    return getUserPermissions(user).can_export_calls;
}
