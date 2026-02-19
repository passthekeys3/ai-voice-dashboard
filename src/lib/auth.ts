import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { AuthUser, Profile, Agency, Client } from '@/types';

/** Roles that have agency-level access (admin panel, all clients) */
export const AGENCY_ROLES = ['agency_admin', 'agency_member'] as const;

/** Roles that have client-level access (own client data only) */
export const CLIENT_ROLES = ['client_admin', 'client_member'] as const;

/**
 * Get the current authenticated user with their profile, agency, and client data
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    // Fetch profile with agency and client
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        return null;
    }

    // Fetch agency
    const { data: agency } = await supabase
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
        const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', profile.client_id)
            .single();
        client = clientData || undefined;
    }

    return {
        id: user.id,
        email: user.email!,
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
 * Check if current user is a client user
 */
export function isClientUser(user: AuthUser): boolean {
    return (CLIENT_ROLES as readonly string[]).includes(user.profile.role);
}
