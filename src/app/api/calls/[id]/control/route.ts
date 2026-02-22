import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import {
    unauthorized,
    forbidden,
    badRequest,
    notFound,
    externalServiceError,
    apiSuccess,
    withErrorHandling,
} from '@/lib/api/response';
import { resolveProviderApiKeys } from '@/lib/providers/resolve-keys';

interface RouteParams {
    params: Promise<{ id: string }>;
}

type ControlAction = 'mute' | 'unmute' | 'say';

const VALID_ACTIONS: ControlAction[] = ['mute', 'unmute', 'say'];
const MAX_SAY_LENGTH = 500;

// Defense-in-depth: ensure controlUrl points to Vapi infrastructure
function isValidVapiControlUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' &&
            (parsed.hostname === 'vapi.ai' || parsed.hostname.endsWith('.vapi.ai'));
    } catch {
        return false;
    }
}

// POST /api/calls/[id]/control - Send control command to a live Vapi call
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
    const body = await request.json();
    const { action, message } = body as { action: ControlAction; message?: string };

    if (!action || !VALID_ACTIONS.includes(action)) {
        return badRequest(`Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`);
    }

    if (action === 'say' && (!message || typeof message !== 'string' || message.trim().length === 0)) {
        return badRequest('Message is required for the "say" action');
    }

    if (action === 'say' && message && message.length > MAX_SAY_LENGTH) {
        return badRequest(`Message must be ${MAX_SAY_LENGTH} characters or fewer`);
    }

    const supabase = await createClient();

    // Look up call in DB (include agent_id for client_id resolution)
    const { data: callRecord } = await supabase
        .from('calls')
        .select('id, external_id, provider, metadata, status, agent_id, agents!inner(agency_id, client_id)')
        .eq('external_id', callId)
        .single();

    if (!callRecord) {
        return notFound('Call');
    }

    const agentData = callRecord.agents as unknown as { agency_id: string; client_id: string | null };
    if (agentData.agency_id !== user.agency.id) {
        return forbidden('You do not have permission to control this call');
    }

    if (callRecord.provider !== 'vapi') {
        return badRequest('Call control is only supported for Vapi calls');
    }

    if (callRecord.status !== 'in_progress') {
        return badRequest('Call is not currently active');
    }

    // Get controlUrl from metadata
    let controlUrl = (callRecord.metadata as Record<string, unknown>)?.vapi_control_url as string | undefined;

    if (!controlUrl) {
        // Fallback: fetch from Vapi API directly using resolved key (client → agency)
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agentData.client_id);
        const vapiKey = resolvedKeys.vapi_api_key;

        if (!vapiKey) {
            return badRequest('Vapi API key not configured');
        }

        const vapiResponse = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
            headers: { 'Authorization': `Bearer ${vapiKey}` },
        });

        if (!vapiResponse.ok) {
            return externalServiceError('Vapi', 'Failed to fetch call details');
        }

        const vapiCall = await vapiResponse.json();
        controlUrl = vapiCall?.monitor?.controlUrl;

        if (!controlUrl) {
            return badRequest('Control URL not available for this call');
        }

        // Cache it for future use
        await supabase
            .from('calls')
            .update({
                metadata: {
                    ...((callRecord.metadata as Record<string, unknown>) || {}),
                    vapi_control_url: controlUrl,
                },
            })
            .eq('external_id', callId);
    }

    // Validate the URL points to Vapi infrastructure
    if (!isValidVapiControlUrl(controlUrl)) {
        console.error('Invalid controlUrl detected:', controlUrl);
        return badRequest('Invalid control URL');
    }

    return await sendControlCommand(controlUrl, action, message);
});

async function sendControlCommand(controlUrl: string, action: ControlAction, message?: string) {
    let payload: Record<string, unknown>;

    switch (action) {
        case 'mute':
            payload = { type: 'control', control: 'mute-assistant' };
            break;
        case 'unmute':
            payload = { type: 'control', control: 'unmute-assistant' };
            break;
        case 'say':
            payload = { type: 'say', content: message, endCallAfterSpoken: false };
            break;
    }

    try {
        const response = await fetch(controlUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`Vapi control command failed: ${action}`, response.status);
            return externalServiceError('Vapi', `Failed to execute ${action} command`);
        }

        return apiSuccess({ message: `${action} command sent successfully` });
    } catch (err) {
        console.error('Vapi control URL error:', err instanceof Error ? err.message : 'Unknown error');
        return externalServiceError('Vapi', 'Failed to communicate with call control endpoint');
    }
}
