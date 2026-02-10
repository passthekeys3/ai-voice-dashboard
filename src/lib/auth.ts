import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { AuthUser, Profile, Agency, AgencyBranding, Client } from '@/types';

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
    // DEV ONLY: Bypass authentication for local development
    // Only works in non-production environments
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
        // Fetch a real agency from the database for dev mode
        const supabase = await createClient();
        const { data: agency } = await supabase
            .from('agencies')
            .select('*')
            .limit(1)
            .single();

        if (agency) {
            return {
                id: 'dev-user-id',
                email: 'dev@localhost',
                profile: {
                    id: 'dev-user-id',
                    email: 'dev@localhost',
                    full_name: 'Dev User',
                    role: 'agency_admin',
                    agency_id: agency.id,
                    client_id: undefined,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as Profile,
                agency: agency as Agency,
            };
        }

        // Fallback if no agency exists
        return {
            id: 'dev-user-id',
            email: 'dev@localhost',
            profile: {
                id: 'dev-user-id',
                email: 'dev@localhost',
                full_name: 'Dev User',
                role: 'agency_admin',
                agency_id: 'dev-agency-id',
                client_id: undefined,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as Profile,
            agency: {
                id: 'dev-agency-id',
                name: 'Dev Agency',
                slug: 'dev-agency',
                branding: {} as AgencyBranding,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as Agency,
        };
    }

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

    if (!['agency_admin', 'agency_member'].includes(user.profile.role)) {
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
    if (['agency_admin', 'agency_member'].includes(user.profile.role)) {
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
    return ['agency_admin', 'agency_member'].includes(user.profile.role);
}

/**
 * Check if current user is a client user
 */
export function isClientUser(user: AuthUser): boolean {
    return ['client_admin', 'client_member'].includes(user.profile.role);
}
