/**
 * Bland.ai API Client
 * https://docs.bland.ai/api-v1/
 *
 * Bland uses "Pathways" (visual flowcharts) as the primary agent concept.
 * A pathway_id maps to our external_id on the agents table.
 * Auth uses a raw API key in the authorization header (NOT Bearer).
 */

import { fetchWithRetry } from '@/lib/retry';

const BLAND_BASE_URL = 'https://api.bland.ai/v1';

// ============================================
// TYPES
// ============================================

export interface BlandPathway {
    id: string;
    name: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
    created_at?: string;
}

export interface BlandCall {
    call_id: string;
    c_id?: string;
    pathway_id?: string;
    to: string;
    from?: string;
    status: string;
    queue_status?: string;
    completed: boolean;
    call_length?: number;       // Duration in MINUTES
    price?: number;             // Cost in DOLLARS
    answered_by?: string;       // 'human' | 'voicemail' | null
    summary?: string;
    recording_url?: string;
    concatenated_transcript?: string;
    transcripts?: Array<{
        id: number;
        created_at: string;
        text: string;
        user: 'assistant' | 'user';
    }>;
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    error_message?: string;
    created_at: string;
    started_at?: string;
    end_at?: string;
}

export interface BlandVoice {
    voice_id: string;
    name: string;
    is_custom?: boolean;
    description?: string;
    preview_url?: string;
}

export interface BlandInboundNumber {
    phone_number: string;
    pathway_id?: string;
    prompt?: string;
    voice?: string;
    webhook?: string;
    created_at?: string;
}

export interface BlandListCallsParams {
    start_date?: string;
    end_date?: string;
    limit?: number;
    status?: string;
    pathway_id?: string;
}

// ============================================
// FETCH WRAPPER
// ============================================

async function blandFetch<T>(
    apiKey: string,
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetchWithRetry(
        `${BLAND_BASE_URL}${path}`,
        {
            ...options,
            headers: {
                'authorization': apiKey,  // Raw key, NOT Bearer
                'Content-Type': 'application/json',
                ...options.headers,
            },
        },
        { onRetry: (attempt, _err, delay) => console.warn(`Bland ${path} retry #${attempt} in ${delay}ms`) },
    );

    if (!response.ok) {
        console.error(`Bland API error [${response.status}] ${path}`);
        throw new Error(`Bland API error: ${response.status}`);
    }

    return response.json();
}

// ============================================
// PATHWAY (AGENT) OPERATIONS
// ============================================

export async function listBlandPathways(apiKey: string): Promise<BlandPathway[]> {
    const result = await blandFetch<BlandPathway[] | { data: BlandPathway[] }>(apiKey, '/all_pathway');
    // API may return array directly or wrapped in { data: [...] }
    return Array.isArray(result) ? result : (result.data || []);
}

export async function getBlandPathway(
    apiKey: string,
    pathwayId: string
): Promise<BlandPathway> {
    return blandFetch<BlandPathway>(apiKey, `/pathway/${pathwayId}`);
}

export async function createBlandPathway(
    apiKey: string,
    config: {
        name: string;
        description?: string;
    }
): Promise<BlandPathway> {
    const result = await blandFetch<{ status: string; pathway_id: string }>(
        apiKey,
        '/pathway/create',
        {
            method: 'POST',
            body: JSON.stringify(config),
        }
    );
    // Return a normalized pathway object
    return {
        id: result.pathway_id,
        name: config.name,
        description: config.description,
        created_at: new Date().toISOString(),
    };
}

export async function updateBlandPathway(
    apiKey: string,
    pathwayId: string,
    config: Partial<{
        name: string;
        description: string;
    }>
): Promise<BlandPathway> {
    await blandFetch(apiKey, `/pathway/${pathwayId}`, {
        method: 'POST',
        body: JSON.stringify(config),
    });
    // Fetch updated pathway
    return getBlandPathway(apiKey, pathwayId);
}

export async function deleteBlandPathway(
    apiKey: string,
    pathwayId: string
): Promise<void> {
    await blandFetch<void>(apiKey, `/pathway/${pathwayId}`, {
        method: 'DELETE',
    });
}

// ============================================
// CALL OPERATIONS
// ============================================

export async function listBlandCalls(
    apiKey: string,
    params?: BlandListCallsParams
): Promise<BlandCall[]> {
    const queryParts: string[] = [];
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.start_date) queryParts.push(`start_date=${params.start_date}`);
    if (params?.end_date) queryParts.push(`end_date=${params.end_date}`);
    if (params?.status) queryParts.push(`status=${params.status}`);
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const result = await blandFetch<BlandCall[] | { calls: BlandCall[] }>(apiKey, `/calls${query}`);
    return Array.isArray(result) ? result : (result.calls || []);
}

export async function getBlandCall(
    apiKey: string,
    callId: string
): Promise<BlandCall> {
    return blandFetch<BlandCall>(apiKey, `/calls/${callId}`);
}

export async function listBlandActiveCalls(apiKey: string): Promise<BlandCall[]> {
    const result = await blandFetch<BlandCall[] | { active_calls: BlandCall[] }>(apiKey, '/active');
    return Array.isArray(result) ? result : (result.active_calls || []);
}

export async function stopBlandCall(
    apiKey: string,
    callId: string
): Promise<void> {
    await blandFetch<void>(apiKey, `/calls/${callId}/stop`, {
        method: 'POST',
    });
}

// ============================================
// VOICE OPERATIONS
// ============================================

export async function listBlandVoices(apiKey: string): Promise<BlandVoice[]> {
    const result = await blandFetch<BlandVoice[] | { voices: BlandVoice[] }>(apiKey, '/voices');
    return Array.isArray(result) ? result : (result.voices || []);
}

// ============================================
// PHONE NUMBER OPERATIONS
// ============================================

export async function listBlandPhoneNumbers(apiKey: string): Promise<BlandInboundNumber[]> {
    const result = await blandFetch<BlandInboundNumber[] | { inbound_numbers: BlandInboundNumber[] }>(
        apiKey,
        '/inbound'
    );
    return Array.isArray(result) ? result : (result.inbound_numbers || []);
}

export async function purchaseBlandInboundNumber(
    apiKey: string,
    areaCode?: string
): Promise<{ phone_number: string }> {
    return blandFetch<{ phone_number: string }>(apiKey, '/inbound/purchase', {
        method: 'POST',
        body: JSON.stringify({ area_code: areaCode || '415' }),
    });
}

export async function purchaseBlandOutboundNumber(
    apiKey: string,
    areaCode?: string
): Promise<{ phone_number: string }> {
    return blandFetch<{ phone_number: string }>(apiKey, '/outbound/purchase', {
        method: 'POST',
        body: JSON.stringify({ area_code: areaCode || '415' }),
    });
}
