/**
 * Vapi API Client
 * https://docs.vapi.ai/api-reference/
 */

import { fetchWithRetry } from '@/lib/retry';

const VAPI_BASE_URL = 'https://api.vapi.ai';

export interface VapiAssistant {
    id: string;
    orgId: string;
    name: string;
    voice?: {
        provider: string;
        voiceId: string;
        speed?: number;
        stability?: number;
    };
    model?: {
        provider: string;
        model: string;
        systemPrompt?: string;
        temperature?: number;
    };
    transcriber?: {
        provider: string;
        model?: string;
        language?: string;
    };
    firstMessage?: string;
    firstMessageMode?: string;
    serverUrl?: string;
    serverUrlSecret?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface VapiCall {
    id: string;
    orgId: string;
    assistantId: string;
    type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
    status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
    endedReason?: string;
    startedAt?: string;
    endedAt?: string;
    transcript?: string;
    messages?: Array<{
        role: 'assistant' | 'user' | 'system' | 'tool_call' | 'tool_result';
        message?: string;
        time: number;
    }>;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    summary?: string;
    cost?: number;
    costBreakdown?: {
        transport?: number;
        stt?: number;
        llm?: number;
        tts?: number;
        vapi?: number;
        total: number;
    };
    customer?: {
        number?: string;
    };
    phoneNumber?: {
        number?: string;
    };
    analysis?: {
        summary?: string;
        successEvaluation?: string;
    };
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface VapiListCallsParams {
    assistantId?: string;
    limit?: number;
    createdAtGt?: string;
    createdAtLt?: string;
    createdAtGe?: string;
    createdAtLe?: string;
}

async function vapiFetch<T>(
    apiKey: string,
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetchWithRetry(
        `${VAPI_BASE_URL}${path}`,
        {
            ...options,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        },
        { onRetry: (attempt, _err, delay) => console.warn(`Vapi ${path} retry #${attempt} in ${delay}ms`) },
    );

    if (!response.ok) {
        console.error(`Vapi API error [${response.status}] ${path}`);
        throw new Error(`Vapi API error: ${response.status}`);
    }

    return response.json();
}

export async function listVapiAssistants(apiKey: string): Promise<VapiAssistant[]> {
    return vapiFetch<VapiAssistant[]>(apiKey, '/assistant');
}

export async function getVapiAssistant(
    apiKey: string,
    assistantId: string
): Promise<VapiAssistant> {
    return vapiFetch<VapiAssistant>(apiKey, `/assistant/${encodeURIComponent(assistantId)}`);
}

export async function createVapiAssistant(
    apiKey: string,
    config: {
        name: string;
        voice?: VapiAssistant['voice'];
        model?: VapiAssistant['model'];
        transcriber?: VapiAssistant['transcriber'];
        firstMessage?: string;
        serverUrl?: string;
    }
): Promise<VapiAssistant> {
    return vapiFetch<VapiAssistant>(apiKey, '/assistant', {
        method: 'POST',
        body: JSON.stringify(config),
    });
}

export async function updateVapiAssistant(
    apiKey: string,
    assistantId: string,
    config: Partial<{
        name: string;
        voice: VapiAssistant['voice'];
        model: VapiAssistant['model'];
        transcriber: VapiAssistant['transcriber'];
        firstMessage: string;
        serverUrl: string;
    }>
): Promise<VapiAssistant> {
    return vapiFetch<VapiAssistant>(apiKey, `/assistant/${encodeURIComponent(assistantId)}`, {
        method: 'PATCH',
        body: JSON.stringify(config),
    });
}

export async function deleteVapiAssistant(
    apiKey: string,
    assistantId: string
): Promise<void> {
    await vapiFetch<void>(apiKey, `/assistant/${encodeURIComponent(assistantId)}`, {
        method: 'DELETE',
    });
}

export async function listVapiCalls(
    apiKey: string,
    params?: VapiListCallsParams
): Promise<VapiCall[]> {
    const searchParams = new URLSearchParams();
    if (params?.assistantId) searchParams.set('assistantId', params.assistantId);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.createdAtGt) searchParams.set('createdAtGt', params.createdAtGt);
    if (params?.createdAtLt) searchParams.set('createdAtLt', params.createdAtLt);

    const queryString = searchParams.toString();
    const path = queryString ? `/call?${queryString}` : '/call';

    return vapiFetch<VapiCall[]>(apiKey, path);
}

export async function getVapiCall(
    apiKey: string,
    callId: string
): Promise<VapiCall> {
    return vapiFetch<VapiCall>(apiKey, `/call/${encodeURIComponent(callId)}`);
}

// Phone Number types and functions
export interface VapiPhoneNumber {
    id: string;
    orgId: string;
    number: string;
    provider: 'twilio' | 'vonage' | 'vapi';
    assistantId?: string;
    squadId?: string;
    serverUrl?: string;
    serverUrlSecret?: string;
    createdAt: string;
    updatedAt: string;
}

export async function listVapiPhoneNumbers(apiKey: string): Promise<VapiPhoneNumber[]> {
    return vapiFetch<VapiPhoneNumber[]>(apiKey, '/phone-number');
}

export async function getVapiPhoneNumber(
    apiKey: string,
    phoneNumberId: string
): Promise<VapiPhoneNumber> {
    return vapiFetch<VapiPhoneNumber>(apiKey, `/phone-number/${encodeURIComponent(phoneNumberId)}`);
}

export async function updateVapiPhoneNumber(
    apiKey: string,
    phoneNumberId: string,
    config: Partial<{
        assistantId: string | null;
        squadId: string | null;
        serverUrl: string;
    }>
): Promise<VapiPhoneNumber> {
    return vapiFetch<VapiPhoneNumber>(apiKey, `/phone-number/${encodeURIComponent(phoneNumberId)}`, {
        method: 'PATCH',
        body: JSON.stringify(config),
    });
}
