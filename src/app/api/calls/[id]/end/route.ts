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

    // Determine the call's provider
    const externalCallId = call?.external_id || callId;

    // Get the call's provider from the calls table
    const { data: callRecord } = await supabase
        .from('calls')
        .select('provider')
        .eq('external_id', externalCallId)
        .single();

    const provider = callRecord?.provider || 'retell';

    // Get agency API keys for all providers
    const { data: agency } = await supabase
        .from('agencies')
        .select('retell_api_key, vapi_api_key, bland_api_key')
        .eq('id', user.agency.id)
        .single();

    if (provider === 'retell') {
        if (!agency?.retell_api_key) {
            return badRequest('Retell API key not configured');
        }
        const endResponse = await fetch(`https://api.retellai.com/v2/end-call/${externalCallId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
                'Content-Type': 'application/json',
            },
        });
        if (!endResponse.ok) {
            const errorData = await endResponse.text();
            console.error('Failed to end Retell call:', errorData);
            return externalServiceError('Retell', 'Failed to end call');
        }
    } else if (provider === 'vapi') {
        if (!agency?.vapi_api_key) {
            return badRequest('Vapi API key not configured');
        }
        // Vapi uses DELETE to hang up a call
        const endResponse = await fetch(`https://api.vapi.ai/call/${externalCallId}/hang`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.vapi_api_key}`,
                'Content-Type': 'application/json',
            },
        });
        if (!endResponse.ok) {
            const errorData = await endResponse.text();
            console.error('Failed to end Vapi call:', errorData);
            return externalServiceError('Vapi', 'Failed to end call');
        }
    } else if (provider === 'bland') {
        if (!agency?.bland_api_key) {
            return badRequest('Bland API key not configured');
        }
        const endResponse = await fetch(`https://api.bland.ai/v1/calls/${externalCallId}/stop`, {
            method: 'POST',
            headers: {
                'authorization': agency.bland_api_key,
                'Content-Type': 'application/json',
            },
        });
        if (!endResponse.ok) {
            const errorData = await endResponse.text();
            console.error('Failed to end Bland call:', errorData);
            return externalServiceError('Bland', 'Failed to end call');
        }
    } else {
        return badRequest('Unsupported provider');
    }

    return apiSuccess({ message: 'Call ended successfully' });
});
