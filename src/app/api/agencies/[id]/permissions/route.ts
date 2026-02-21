import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    badRequest,
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
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
        return badRequest('Permissions must be a non-null object');
    }

    // Whitelist of valid permission keys (must match client permissions)
    const VALID_PERMISSION_KEYS = ['show_costs', 'show_transcripts', 'show_analytics', 'allow_playback', 'can_edit_agents', 'can_create_agents', 'can_export_calls'];
    const invalidKeys = Object.keys(permissions).filter(k => !VALID_PERMISSION_KEYS.includes(k));
    if (invalidKeys.length > 0) {
        return badRequest(`Invalid permission keys: ${invalidKeys.join(', ')}`);
    }

    // Validate all values are booleans
    const invalidValues = Object.entries(permissions).filter(([, v]) => typeof v !== 'boolean');
    if (invalidValues.length > 0) {
        return badRequest('Permission values must be booleans');
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
