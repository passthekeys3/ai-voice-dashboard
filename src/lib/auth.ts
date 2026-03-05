import { createClient, createAuthClient, createServiceClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/admin';
import type { AuthUser, Profile, Agency, Client } from '@/types';

/** Roles that have agency-level access (admin panel, all clients) */
export const AGENCY_ROLES = ['agency_admin', 'agency_member'] as const;

/** Roles that have client-level access (own client data only) */
export const CLIENT_ROLES = ['client_admin', 'client_member'] as const;

/** All valid roles — used to reject corrupted/tampered role values */
const VALID_ROLES = new Set<string>([...AGENCY_ROLES, ...CLIENT_ROLES]);

/**
 * Get the current authenticated user with their profile, agency, and client data.
 *
 * During admin impersonation, the real user's auth identity is preserved
 * (via `createAuthClient`) while the agency context is overridden to
 * the target agency (via `createServiceClient`). The returned `AuthUser`
 * includes `isImpersonating: true` and `realAgencyId` so callers can
 * detect impersonation when needed.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    // Always use the auth client for identity — never a service client
    const authSupabase = await createAuthClient();

    const {
        data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
        return null;
    }

    if (!user.email) {
        return null;
    }

    // Fetch profile using auth client (profile is in the admin's own agency)
    const { data: profile } = await authSupabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        return null;
    }

    // Reject invalid/corrupted role values before trusting the profile
    if (!VALID_ROLES.has(profile.role)) {
        console.error('Invalid profile role detected:', profile.id);
        return null;
    }

    // ── Impersonation check ───────────────────────────────────────────
    const cookieStore = await cookies();
    const impersonateAgencyId = cookieStore.get('admin_impersonate')?.value;

    if (impersonateAgencyId && isPlatformAdmin(user.email)) {
        // Fetch target agency via service client (bypasses RLS)
        const serviceSupabase = createServiceClient();
        const { data: targetAgency } = await serviceSupabase
            .from('agencies')
            .select('*')
            .eq('id', impersonateAgencyId)
            .single();

        if (!targetAgency) {
            // Target agency doesn't exist — fall through to normal flow
            console.warn('[IMPERSONATION] Target agency not found:', impersonateAgencyId);
        } else {
            return {
                id: user.id,
                email: user.email,
                profile: {
                    ...profile,
                    agency_id: targetAgency.id,
                    role: 'agency_admin', // Admin gets full access during impersonation
                } as Profile,
                agency: targetAgency as Agency,
                isImpersonating: true,
                realAgencyId: profile.agency_id,
            };
        }
    }

    // ── Normal (non-impersonating) flow ────────────────────────────────
    const { data: agency } = await authSupabase
        .from('agencies')
        .select('*')
        .eq('id', profile.agency_id)
        .single();

    if (!agency) {
        return null;
    }

    // Fetch client if user is a client user
    let client: Client | undefined;
    if (profile.client_id) {
        const { data: clientData } = await authSupabase
            .from('clients')
            .select('*')
            .eq('id', profile.client_id)
            .single();
        client = clientData || undefined;
    }

    return {
        id: user.id,
        email: user.email,
        profile: profile as Profile,
        agency: agency as Agency,
        client,
    };
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    return user;
}

/**
 * Require agency admin role - redirects if not admin
 */
export async function requireAgencyAdmin(): Promise<AuthUser> {
    const user = await requireAuth();

    if (!(AGENCY_ROLES as readonly string[]).includes(user.profile.role)) {
        redirect('/');
    }

    return user;
}

/**
 * Require client access - ensures user can access specific client
 */
export async function requireClientAccess(clientId: string): Promise<AuthUser> {
    const user = await requireAuth();

    // Agency admins/members can access any client in their agency
    if ((AGENCY_ROLES as readonly string[]).includes(user.profile.role)) {
        const supabase = await createClient();
        const { data: client } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!client) {
            redirect('/');
        }

        return user;
    }

    // Client users can only access their own client
    if (user.profile.client_id !== clientId) {
        redirect('/');
    }

    return user;
}

/**
 * Check if current user is an agency admin
 */
export function isAgencyAdmin(user: AuthUser): boolean {
    return (AGENCY_ROLES as readonly string[]).includes(user.profile.role);
}

/**
 * Check if the user is the agency owner (agency_admin only).
 * Used for billing/subscription management where agency_member access is intentionally restricted.
 */
export function isBillingAdmin(user: AuthUser): boolean {
    return user.profile.role === 'agency_admin';
}

/**
 * Check if current user is a client user
 */
export function isClientUser(user: AuthUser): boolean {
    return (CLIENT_ROLES as readonly string[]).includes(user.profile.role);
}
