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
            can_manage_integrations: true,
        };
    }

    // Client users get their client's permissions
    return getClientPermissions(user.client, user.agency);
}
