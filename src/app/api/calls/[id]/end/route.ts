import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    notFound,
    badRequest,
    externalServiceError,
    apiSuccess,
    withErrorHandling,
} from '@/lib/api/response';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/calls/[id]/end - End an active call
export const POST = withErrorHandling(async (
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

    const { id: callId } = await context!.params;
    const supabase = await createClient();

    // SECURITY: Verify the call belongs to this agency before allowing end
    const { data: call, error: callError } = await supabase
        .from('calls')
        .select('id, external_id, agents!inner(agency_id)')
        .eq('external_id', callId)
        .single();

    if (callError || !call) {
        // Also try by internal ID
        const { data: callById } = await supabase
            .from('calls')
            .select('id, external_id, agents!inner(agency_id)')
            .eq('id', callId)
            .single();

        if (!callById) {
            return notFound('Call');
        }

        // Verify ownership
        const agentData = callById.agents as unknown as { agency_id: string };
        if (agentData.agency_id !== user.agency.id) {
            return forbidden('You do not have permission to end this call');
        }
    } else {
        // Verify ownership
        const agentData = call.agents as unknown as { agency_id: string };
        if (agentData.agency_id !== user.agency.id) {
            return forbidden('You do not have permission to end this call');
        }
    }

    // Get agency's Retell API key
    const { data: agency } = await supabase
        .from('agencies')
        .select('retell_api_key')
        .eq('id', user.agency.id)
        .single();

    if (!agency?.retell_api_key) {
        return badRequest('Retell API key not configured');
    }

    // Use the external_id for Retell API
    const retellCallId = call?.external_id || callId;

    // End the call via Retell API
    const endResponse = await fetch(`https://api.retellai.com/v2/end-call/${retellCallId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${agency.retell_api_key}`,
            'Content-Type': 'application/json',
        },
    });

    if (!endResponse.ok) {
        const errorData = await endResponse.text();
        console.error('Failed to end call:', errorData);
        return externalServiceError('Retell', 'Failed to end call');
    }

    return apiSuccess({ message: 'Call ended successfully' });
});
