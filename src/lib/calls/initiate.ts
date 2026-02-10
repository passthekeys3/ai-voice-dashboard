/**
 * Provider-Agnostic Call Initiation
 *
 * Abstracts the actual call placement across voice providers (Retell, Vapi).
 * Used by both the cron processor and the GHL trigger webhook.
 */

export interface CallInitiationParams {
    provider: 'retell' | 'vapi';
    providerApiKey: string;
    externalAgentId: string;
    toNumber: string;
    fromNumber?: string;
    metadata?: Record<string, unknown>;
}

export interface CallInitiationResult {
    success: boolean;
    callId?: string;
    error?: string;
}

/**
 * Initiate an outbound phone call via the appropriate voice provider.
 */
export async function initiateCall(params: CallInitiationParams): Promise<CallInitiationResult> {
    switch (params.provider) {
        case 'retell':
            return initiateRetellCall(params);
        case 'vapi':
            return initiateVapiCall(params);
        default:
            return { success: false, error: `Unsupported provider: ${params.provider}` };
    }
}

/**
 * Initiate call via Retell AI API
 */
async function initiateRetellCall(params: CallInitiationParams): Promise<CallInitiationResult> {
    try {
        const body: Record<string, unknown> = {
            agent_id: params.externalAgentId,
            to_number: params.toNumber,
            metadata: params.metadata || {},
        };

        if (params.fromNumber) {
            body.from_number = params.fromNumber;
        }

        const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${params.providerApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.message || `Retell API error: ${response.status}`,
            };
        }

        const data = await response.json();
        return { success: true, callId: data.call_id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Retell call initiation failed',
        };
    }
}

/**
 * Initiate call via Vapi API
 */
async function initiateVapiCall(params: CallInitiationParams): Promise<CallInitiationResult> {
    try {
        const body: Record<string, unknown> = {
            assistantId: params.externalAgentId,
            customer: {
                number: params.toNumber,
            },
            metadata: params.metadata || {},
        };

        if (params.fromNumber) {
            body.phoneNumberId = params.fromNumber; // Vapi uses phone number ID
        }

        const response = await fetch('https://api.vapi.ai/call/phone', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${params.providerApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.message || `Vapi API error: ${response.status}`,
            };
        }

        const data = await response.json();
        return { success: true, callId: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Vapi call initiation failed',
        };
    }
}
