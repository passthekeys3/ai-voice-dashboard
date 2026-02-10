import type { Agency, Client, ClientPermissions, AuthUser } from '@/types';
import { DEFAULT_CLIENT_PERMISSIONS } from '@/types/database';

/**
 * Resolve the effective permissions for a client.
 * Uses client-specific overrides if set, otherwise falls back to agency defaults.
 */
export function getClientPermissions(
    client: Client | undefined,
    agency: Agency
): ClientPermissions {
    // If client has explicit permissions, use them
    if (client?.permissions) {
        return client.permissions;
    }

    // Otherwise use agency defaults
    if (agency.default_client_permissions) {
        return agency.default_client_permissions;
    }

    // Fallback to system defaults
    return DEFAULT_CLIENT_PERMISSIONS;
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
