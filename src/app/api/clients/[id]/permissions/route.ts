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

// PATCH /api/clients/[id]/permissions - Update client-specific permission overrides
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

    const { id: clientId } = await context!.params;
    const body = await request.json();
    const { permissions } = body as { permissions: ClientPermissions | null };

    // Validate permissions object structure if provided
    if (permissions !== null && permissions !== undefined) {
        if (typeof permissions !== 'object' || Array.isArray(permissions)) {
            return forbidden('Permissions must be an object or null');
        }

        // Whitelist of valid permission keys
        const VALID_PERMISSION_KEYS = ['show_costs', 'show_transcripts', 'show_analytics', 'allow_playback'];
        const invalidKeys = Object.keys(permissions).filter(k => !VALID_PERMISSION_KEYS.includes(k));
        if (invalidKeys.length > 0) {
            return forbidden(`Invalid permission keys: ${invalidKeys.join(', ')}`);
        }

        // Validate all values are booleans
        const invalidValues = Object.entries(permissions).filter(([, v]) => typeof v !== 'boolean');
        if (invalidValues.length > 0) {
            return forbidden('Permission values must be booleans');
        }
    }

    const supabase = await createClient();

    // Verify client belongs to this agency
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, agency_id')
        .eq('id', clientId)
        .eq('agency_id', user.agency.id)
        .single();

    if (clientError || !client) {
        return notFound('Client');
    }

    // Update client permissions (null removes override, uses agency defaults)
    const { data, error } = await supabase
        .from('clients')
        .update({
            permissions: permissions,
            updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .select()
        .single();

    if (error) {
        return databaseError(error);
    }

    return apiSuccess(data);
});
