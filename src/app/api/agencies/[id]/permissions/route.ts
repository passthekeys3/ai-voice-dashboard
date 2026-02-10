import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    apiSuccess,
    databaseError,
    withErrorHandling,
} from '@/lib/api/response';
import type { ClientPermissions } from '@/types';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH /api/agencies/[id]/permissions - Update agency default permissions
export const PATCH = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    if (!isAgencyAdmin(user)) {
        return forbidden();
    }

    const { id: agencyId } = await context!.params;

    // Verify user belongs to this agency
    if (user.agency.id !== agencyId) {
        return forbidden();
    }

    const body = await request.json();
    const { permissions } = body as { permissions: ClientPermissions };

    // Validate permissions object
    if (!permissions || typeof permissions !== 'object') {
        return notFound('Permissions');
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('agencies')
        .update({
            default_client_permissions: permissions,
            updated_at: new Date().toISOString(),
        })
        .eq('id', agencyId)
        .select()
        .single();

    if (error) {
        return databaseError(error);
    }

    return apiSuccess(data);
});
