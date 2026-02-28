import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    badRequest,
    apiSuccess,
    withErrorHandling,
} from '@/lib/api/response';
import { isValidUuid } from '@/lib/validation';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (
    request: NextRequest,
    context?: RouteParams
) => {
    const user = await getCurrentUser();
    if (!user) {
        return unauthorized();
    }

    const { id } = await context!.params;
    if (!isValidUuid(id)) {
        return badRequest('Invalid ID format');
    }
    const supabase = await createClient();

    const { data: call, error } = await supabase
        .from('calls')
        .select('*, agents(name, provider, agency_id)')
        .eq('id', id)
        .single();

    if (error || !call) {
        return notFound('Call');
    }

    // Verify agency access
    if (call.agents?.agency_id !== user.agency.id) {
        return forbidden();
    }

    // Client users can only access their own calls
    if (!isAgencyAdmin(user) && call.client_id !== user.client?.id) {
        return forbidden();
    }

    return apiSuccess(call);
});
