import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    badRequest,
    externalServiceError,
    apiSuccess,
    withErrorHandling,
} from '@/lib/api/response';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/calls/[id]/end?provider=retell - End an active call
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
    const providerParam = request.nextUrl.searchParams.get('provider') || 'retell';
    const supabase = await createClient();

    // Validate provider param
    const validProviders = ['retell', 'vapi', 'bland'];
    if (!validProviders.includes(providerParam)) {
        return badRequest('Unsupported provider');
    }

    // Try DB lookup for ownership verification (optional — call may not be in DB yet for inbound calls)
    let externalCallId = callId;
    let provider = providerParam;
    let clientId: string | null = null;

    const { data: callRecord } = await supabase
        .from('calls')
        .select('id, external_id, provider, agent_id, agents!inner(agency_id, client_id)')
        .eq('external_id', callId)
        .single();

    if (callRecord) {
        // Verify ownership via agent's agency
        const agentData = callRecord.agents as unknown as { agency_id: string; client_id: string | null };
        if (agentData.agency_id !== user.agency.id) {
            return forbidden('You do not have permission to end this call');
        }
        externalCallId = callRecord.external_id;
        provider = callRecord.provider;
        clientId = agentData.client_id;
    }
    // If not found in DB: proceed anyway — user is authenticated as agency_admin,
    // and the provider API key scoping ensures they can only end calls under their own account.
    // This handles inbound calls where the webhook hasn't been processed yet.

    // Resolve API key: client key → agency key fallback
    const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, clientId);
    const apiKey = getProviderKey(resolvedKeys, provider as 'retell' | 'vapi' | 'bland');

    if (!apiKey) {
        return badRequest(`${provider} API key not configured`);
    }

    if (provider === 'retell') {
        const endResponse = await fetch(`https://api.retellai.com/v2/end-call/${externalCallId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
        if (!endResponse.ok) {
            const errorData = await endResponse.text();
            console.error('Failed to end Retell call:', errorData);
            return externalServiceError('Retell', 'Failed to end call');
        }
    } else if (provider === 'vapi') {
        const endResponse = await fetch(`https://api.vapi.ai/call/${externalCallId}/hang`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
        if (!endResponse.ok) {
            const errorData = await endResponse.text();
            console.error('Failed to end Vapi call:', errorData);
            return externalServiceError('Vapi', 'Failed to end call');
        }
    } else if (provider === 'bland') {
        const endResponse = await fetch(`https://api.bland.ai/v1/calls/${externalCallId}/stop`, {
            method: 'POST',
            headers: {
                'authorization': apiKey,
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
