/**
 * Retell AI API Client
 * https://docs.retellai.com/api-references/
 */

const RETELL_BASE_URL = 'https://api.retellai.com';

export interface RetellAgent {
    agent_id: string;
    agent_name: string;
    voice_id: string;
    llm_websocket_url?: string;
    webhook_url?: string;
    language?: string;
    ambient_sound?: string;
    responsiveness?: number;
    interruption_sensitivity?: number;
    response_engine?: {
        type: string;
        llm_id?: string;
        version?: number;
    };
    llm_id?: string;
    webhook_events?: string[];
    created_at: string;
    last_modification_timestamp: number;
}

/** Required webhook events for live transcript support */
export const REQUIRED_WEBHOOK_EVENTS = ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated'];

export interface RetellLLM {
    llm_id: string;
    model?: string;
    general_prompt?: string;
    begin_message?: string;
    inbound_dynamic_variables_webhook_url?: string;
    general_tools?: unknown[];
    states?: unknown[];
}

export interface RetellCall {
    call_id: string;
    agent_id: string;
    call_type: 'web_call' | 'phone_call';
    call_status: 'registered' | 'ongoing' | 'ended' | 'error';
    start_timestamp: number;
    end_timestamp?: number;
    transcript?: string;
    transcript_object?: Array<{
        role: string;
        content: string;
        words?: Array<{ word: string; start: number; end: number }>;
    }>;
    recording_url?: string;
    public_log_url?: string;
    from_number?: string;
    to_number?: string;
    direction?: 'inbound' | 'outbound';
    metadata?: Record<string, unknown>;
    call_analysis?: {
        call_summary?: string;
        user_sentiment?: string;
        agent_sentiment?: string;
        custom_analysis_data?: Record<string, unknown>;
    };
    call_cost?: {
        combined_cost?: number; // in cents
        product_costs?: Array<{ product: string; cost: number; unit_price?: number }>;
        total_duration_seconds?: number;
    };
    disconnection_reason?: string;
}

export interface RetellListCallsParams {
    filter_criteria?: {
        agent_id?: string[];
        call_status?: string[];
        call_type?: string[];
        start_timestamp?: { lower_threshold?: number; upper_threshold?: number };
        end_timestamp?: { lower_threshold?: number; upper_threshold?: number };
    };
    sort_order?: 'ascending' | 'descending';
    limit?: number;
    pagination_key?: string;
}

async function retellFetch<T>(
    apiKey: string,
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${RETELL_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Retell API error: ${response.status} - ${error}`);
    }

    return response.json();
}

export async function listRetellAgents(apiKey: string): Promise<RetellAgent[]> {
    return retellFetch<RetellAgent[]>(apiKey, '/list-agents');
}

export async function getRetellAgent(
    apiKey: string,
    agentId: string
): Promise<RetellAgent> {
    return retellFetch<RetellAgent>(apiKey, `/get-agent/${agentId}`);
}

export async function createRetellAgent(
    apiKey: string,
    config: {
        agent_name: string;
        voice_id: string;
        llm_websocket_url?: string;
        webhook_url?: string;
        language?: string;
        webhook_events?: string[];
    }
): Promise<RetellAgent> {
    return retellFetch<RetellAgent>(apiKey, '/create-agent', {
        method: 'POST',
        body: JSON.stringify(config),
    });
}

export async function updateRetellAgent(
    apiKey: string,
    agentId: string,
    config: Partial<{
        agent_name: string;
        voice_id: string;
        llm_websocket_url: string;
        webhook_url: string | null;
        language: string;
        webhook_events: string[];
    }>
): Promise<RetellAgent> {
    return retellFetch<RetellAgent>(apiKey, `/update-agent/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify(config),
    });
}

/**
 * Ensure an agent has the required webhook_url and webhook_events configured.
 * Returns true if the agent was patched, false if already up to date.
 */
export async function ensureAgentWebhookConfig(
    apiKey: string,
    agent: RetellAgent,
    webhookUrl: string
): Promise<boolean> {
    const currentEvents = agent.webhook_events || [];
    const missingEvents = REQUIRED_WEBHOOK_EVENTS.filter(e => !currentEvents.includes(e));
    const needsUrlUpdate = !agent.webhook_url || agent.webhook_url !== webhookUrl;
    const needsEventsUpdate = missingEvents.length > 0;

    if (!needsUrlUpdate && !needsEventsUpdate) return false;

    const update: Partial<{ webhook_url: string; webhook_events: string[] }> = {};

    if (needsUrlUpdate) {
        update.webhook_url = webhookUrl;
    }

    if (needsEventsUpdate) {
        update.webhook_events = [...new Set([...currentEvents, ...REQUIRED_WEBHOOK_EVENTS])];
    }

    await updateRetellAgent(apiKey, agent.agent_id, update);
    return true;
}

export async function deleteRetellAgent(
    apiKey: string,
    agentId: string
): Promise<void> {
    await retellFetch<void>(apiKey, `/delete-agent/${agentId}`, {
        method: 'DELETE',
    });
}

export async function listRetellCalls(
    apiKey: string,
    params?: RetellListCallsParams
): Promise<RetellCall[]> {
    return retellFetch<RetellCall[]>(apiKey, '/v2/list-calls', {
        method: 'POST',
        body: JSON.stringify(params || {}),
    });
}

export async function getRetellCall(
    apiKey: string,
    callId: string
): Promise<RetellCall> {
    return retellFetch<RetellCall>(apiKey, `/v2/get-call/${callId}`);
}

export async function getRetellLLM(
    apiKey: string,
    llmId: string
): Promise<RetellLLM> {
    return retellFetch<RetellLLM>(apiKey, `/get-retell-llm/${llmId}`);
}

export interface UpdateRetellLLMParams {
    general_prompt?: string;
    begin_message?: string | null;
    model?: string;
}

export async function updateRetellLLM(
    apiKey: string,
    llmId: string,
    params: UpdateRetellLLMParams
): Promise<RetellLLM> {
    return retellFetch<RetellLLM>(apiKey, `/update-retell-llm/${llmId}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}

// ============================================
// KNOWLEDGE BASE TYPES & FUNCTIONS
// Uses form-data + native https to bypass Next.js fetch polyfill
// (Next.js's undici-based fetch mangles multipart/form-data)
// ============================================

import FormData from 'form-data';
import https from 'https';

export interface RetellKnowledgeBase {
    knowledge_base_id: string;
    knowledge_base_name: string;
    status: 'in_progress' | 'complete' | 'error';
    knowledge_base_sources?: RetellKBSource[];
    created_at?: number;
    last_refreshed_at?: number;
}

export interface RetellKBSource {
    source_id: string;
    source_type: 'file' | 'url' | 'text';
    source_name?: string;
    source_url?: string;
    content?: string;
    status?: 'in_progress' | 'complete' | 'error';
}

export interface CreateKnowledgeBaseParams {
    knowledge_base_name: string;
    knowledge_base_texts?: Array<{ title: string; text: string }>;
    knowledge_base_urls?: Array<{ url: string; enable_auto_refresh?: boolean }>;
}

export interface AddKBSourcesParams {
    knowledge_base_texts?: Array<{ title: string; text: string }>;
    knowledge_base_urls?: Array<{ url: string; enable_auto_refresh?: boolean }>;
}

function retellMultipartPost<T>(
    apiKey: string,
    path: string,
    form: FormData
): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = https.request(
            `https://api.retellai.com${path}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...form.getHeaders(),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`Retell API error: ${res.statusCode} - ${data}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(data) as T);
                    } catch {
                        reject(new Error(`Invalid JSON response: ${data}`));
                    }
                });
            }
        );
        req.on('error', reject);
        form.pipe(req);
    });
}

export async function listRetellKnowledgeBases(
    apiKey: string
): Promise<RetellKnowledgeBase[]> {
    return retellFetch<RetellKnowledgeBase[]>(apiKey, '/list-knowledge-bases');
}

export async function getRetellKnowledgeBase(
    apiKey: string,
    kbId: string
): Promise<RetellKnowledgeBase> {
    return retellFetch<RetellKnowledgeBase>(apiKey, `/get-knowledge-base/${kbId}`);
}

export async function createRetellKnowledgeBase(
    apiKey: string,
    params: CreateKnowledgeBaseParams
): Promise<RetellKnowledgeBase> {
    const form = new FormData();
    form.append('knowledge_base_name', params.knowledge_base_name);
    if (params.knowledge_base_texts) {
        form.append('knowledge_base_texts', JSON.stringify(params.knowledge_base_texts));
    }
    if (params.knowledge_base_urls) {
        form.append('knowledge_base_urls', JSON.stringify(params.knowledge_base_urls.map(u => u.url)));
    }
    return retellMultipartPost<RetellKnowledgeBase>(apiKey, '/create-knowledge-base', form);
}

export async function deleteRetellKnowledgeBase(
    apiKey: string,
    kbId: string
): Promise<void> {
    await retellFetch(apiKey, `/delete-knowledge-base/${kbId}`, {
        method: 'DELETE',
    });
}

export async function addRetellKBSources(
    apiKey: string,
    kbId: string,
    params: AddKBSourcesParams
): Promise<RetellKnowledgeBase> {
    const form = new FormData();
    if (params.knowledge_base_texts) {
        form.append('knowledge_base_texts', JSON.stringify(params.knowledge_base_texts));
    }
    if (params.knowledge_base_urls) {
        form.append('knowledge_base_urls', JSON.stringify(params.knowledge_base_urls.map(u => u.url)));
    }
    return retellMultipartPost<RetellKnowledgeBase>(apiKey, `/add-knowledge-base-sources/${kbId}`, form);
}

export async function deleteRetellKBSource(
    apiKey: string,
    kbId: string,
    sourceId: string
): Promise<void> {
    await retellFetch(apiKey, `/delete-knowledge-base-source/${kbId}/${sourceId}`, {
        method: 'DELETE',
    });
}
