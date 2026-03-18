/**
 * Provider-Agnostic Call Initiation
 *
 * Abstracts the actual call placement across voice providers (Retell, Vapi, Bland).
 * Used by both the cron processor and the GHL trigger webhook.
 */

export interface CallInitiationParams {
    provider: 'retell' | 'vapi' | 'bland';
    providerApiKey: string;
    externalAgentId: string;
    toNumber: string;
    fromNumber?: string;
    metadata?: Record<string, unknown>;
    /**
     * Optional prompt override for A/B experiments.
     * - Retell: Uses override_agent_config.llm_config.general_prompt (per-call override)
     * - Vapi: Uses assistantOverrides.model.messages to replace system prompt
     * - Bland: Overrides the `task` parameter directly (full prompt replacement)
     */
    promptOverride?: string;
}

export interface CallInitiationResult {
    success: boolean;
    callId?: string;
    error?: string;
}

/** Timeout for provider API calls (30 seconds) */
const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Initiate an outbound phone call via the appropriate voice provider.
 */
export async function initiateCall(params: CallInitiationParams): Promise<CallInitiationResult> {
    switch (params.provider) {
        case 'retell':
            return initiateRetellCall(params);
        case 'vapi':
            return initiateVapiCall(params);
        case 'bland':
            return initiateBlandCall(params);
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

        // Override the agent's prompt for A/B experiment variants.
        // Uses Retell's override_agent_config to replace the prompt at call time
        // without modifying the agent's saved configuration.
        if (params.promptOverride) {
            body.override_agent_config = {
                llm_config: {
                    general_prompt: params.promptOverride,
                },
            };
        }

        const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${params.providerApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });

        if (!response.ok) {
            console.error('Retell call initiation error:', response.status);
            return {
                success: false,
                error: 'Failed to initiate call via Retell',
            };
        }

        const data = await response.json();
        return { success: true, callId: data.call_id };
    } catch (error) {
        console.error('Retell call initiation exception:', error instanceof Error ? error.message : 'Unknown error');
        return {
            success: false,
            error: 'Failed to initiate call via Retell',
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

        // Override the assistant's prompt for A/B experiment variants.
        // Uses Vapi's assistantOverrides to replace the system prompt at call time.
        if (params.promptOverride) {
            body.assistantOverrides = {
                model: {
                    messages: [
                        { role: 'system', content: params.promptOverride },
                    ],
                },
            };
        }

        const response = await fetch('https://api.vapi.ai/call/phone', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${params.providerApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });

        if (!response.ok) {
            console.error('Vapi call initiation error:', response.status);
            return {
                success: false,
                error: 'Failed to initiate call via Vapi',
            };
        }

        const data = await response.json();
        return { success: true, callId: data.id };
    } catch (error) {
        console.error('Vapi call initiation exception:', error instanceof Error ? error.message : 'Unknown error');
        return {
            success: false,
            error: 'Failed to initiate call via Vapi',
        };
    }
}

/**
 * Initiate call via Bland.ai API
 * Bland uses pathway_id (our external_id) to reference the agent.
 * Webhook URL is set per-call since Bland doesn't have agent-level webhook config.
 */
async function initiateBlandCall(params: CallInitiationParams): Promise<CallInitiationResult> {
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

        if (!appUrl) {
            return { success: false, error: 'Server URL not configured. Set NEXT_PUBLIC_APP_URL to enable call initiation.' };
        }

        const body: Record<string, unknown> = {
            phone_number: params.toNumber,
            pathway_id: params.externalAgentId,
            webhook: `${appUrl}/api/webhooks/bland`,
            metadata: params.metadata || {},
        };

        if (params.fromNumber) {
            body.from = params.fromNumber;
        }

        // Bland supports direct task/prompt override per-call
        if (params.promptOverride) {
            body.task = params.promptOverride;
        }

        const response = await fetch('https://api.bland.ai/v1/calls', {
            method: 'POST',
            headers: {
                'authorization': params.providerApiKey,  // Raw key, NOT Bearer
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });

        if (!response.ok) {
            console.error('Bland call initiation error:', response.status);
            return {
                success: false,
                error: 'Failed to initiate call via Bland',
            };
        }

        const data = await response.json();
        return { success: true, callId: data.call_id };
    } catch (error) {
        console.error('Bland call initiation exception:', error instanceof Error ? error.message : 'Unknown error');
        return {
            success: false,
            error: 'Failed to initiate call via Bland',
        };
    }
}
