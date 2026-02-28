import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    badRequest,
    noContent,
    internalError,
    withErrorHandling,
} from '@/lib/api/response';
import { isValidUuid } from '@/lib/validation';

// Use admin client to delete auth users (same pattern as invite route)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ id: string; userId: string }>;
}

/**
 * DELETE /api/clients/[id]/users/[userId]
 * Remove a user from a client and permanently delete their auth account.
 * Agency admin only.
 */
export const DELETE = withErrorHandling(async (
    _request: NextRequest,
    context?: RouteParams,
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id: clientId, userId } = await context!.params;

    if (!isValidUuid(clientId) || !isValidUuid(userId)) {
        return badRequest('Invalid ID format');
    }

    // Verify the client belongs to this agency
    const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('agency_id', user.agency.id)
        .single();

    if (!client) {
        return notFound('Client');
    }

    // Verify the user profile belongs to this client and agency
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .eq('client_id', clientId)
        .eq('agency_id', user.agency.id)
        .single();

    if (!profile) {
        return notFound('User');
    }

    // Prevent self-deletion
    if (userId === user.profile.id) {
        return badRequest('You cannot delete your own account');
    }

    // Delete the auth user — profile cascade-deletes automatically
    // (profiles.id → auth.users(id) ON DELETE CASCADE)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
        console.error('Failed to delete auth user:', authError.message);
        return internalError('Failed to delete user account');
    }

    return noContent();
});
