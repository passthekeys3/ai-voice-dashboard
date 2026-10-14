/**
 * ElevenLabs Conversational AI API Client
 * https://elevenlabs.io/docs/api-reference/agents
 */

import { fetchWithRetry } from '@/lib/retry';
import { DEFAULT_MODELS, ELEVENLABS_DEFAULT_VOICE_ID } from '@/lib/constants/config';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';

// ── Types ───────────────────────────────────────────────────

export interface ElevenLabsAgent {
    agent_id: string;
    name?: string;
    conversation_config?: {
        agent?: {
            first_message?: string;
            language?: string;
            prompt?: {
                prompt?: string;
                llm?: string;
                temperature?: number;
                max_tokens?: number;
            };
        };
        asr?: {
            quality?: string;
            provider?: string;
            user_input_audio_format?: string;
        };
        tts?: {
            model_id?: string;
            voice_id?: string;
            stability?: number;
            speed?: number;
            similarity_boost?: number;
        };
        turn?: {
            turn_timeout?: number;
            turn_eagerness?: string;
        };
        conversation?: {
            max_duration_seconds?: number;
        };
    };
    platform_settings?: {
        widget?: Record<string, unknown>;
        workspace_overrides?: {
            webhooks?: {
                post_call_webhook_id?: string | null;
                events?: string[];
            };
        };
    };
    metadata?: {
        created_at_unix_secs?: number;
        updated_at_unix_secs?: number;
    };
}

export interface ElevenLabsTranscriptTurn {
    role: 'agent' | 'user';
    message?: string | null;
    time_in_call_secs?: number;
}

export interface ElevenLabsAnalysis {
    call_successful?: 'success' | 'failure' | 'unknown';
    transcript_summary?: string;
    evaluation_criteria_results?: Record<string, unknown>;
    data_collection_results?: Record<string, unknown>;
}

export interface ElevenLabsPhoneCall {
    direction?: 'inbound' | 'outbound';
    agent_number?: string;
    external_number?: string;
    type?: string;
}

/** Full conversation (GET /v1/convai/conversations/{id}); also the `data` of post-call webhooks */
export interface ElevenLabsConversation {
    conversation_id: string;
    agent_id: string;
    status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
    transcript?: ElevenLabsTranscriptTurn[];
    metadata?: {
        start_time_unix_secs?: number;
        call_duration_secs?: number;
        /** Total cost in USD */
        cost_fiat?: number | null;
        phone_call?: ElevenLabsPhoneCall | null;
        termination_reason?: string;
        [key: string]: unknown;
    };
    analysis?: ElevenLabsAnalysis | null;
    conversation_initiation_client_data?: {
        dynamic_variables?: Record<string, unknown>;
    };
}

/** Conversation summary returned by GET /v1/convai/conversations */
export interface ElevenLabsConversationSummary {
    conversation_id: string;
    agent_id: string;
    status: ElevenLabsConversation['status'];
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    call_successful?: ElevenLabsAnalysis['call_successful'];
    transcript_summary?: string | null;
    direction?: 'inbound' | 'outbound' | null;
}

export interface ElevenLabsListConversationsResponse {
    conversations: ElevenLabsConversationSummary[];
    has_more: boolean;
    next_cursor?: string | null;
}

// ── Fetch Wrapper ───────────────────────────────────────────

async function elevenlabsFetch<T>(
    apiKey: string,
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetchWithRetry(
        `${ELEVENLABS_BASE_URL}${path}`,
        {
            ...options,
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        },
        { onRetry: (attempt, _err, delay) => console.warn(`ElevenLabs ${path} retry #${attempt} in ${delay}ms`) },
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`ElevenLabs API error [${response.status}] ${path}:`, errorText.slice(0, 500));
        throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    return response.json();
}

// ── Agent CRUD ──────────────────────────────────────────────

export async function createElevenLabsAgent(
    apiKey: string,
    config: {
        name: string;
        prompt?: string;
        firstMessage?: string;
        llmModel?: string;
        voiceModel?: string;
        voiceId?: string;
        language?: string;
        /** Workspace webhook (see ensureElevenLabsWebhook) that receives post-call data */
        postCallWebhookId?: string | null;
    }
): Promise<ElevenLabsAgent> {
    const body: Record<string, unknown> = {
        name: config.name,
        conversation_config: {
            agent: {
                first_message: config.firstMessage || undefined,
                language: config.language || 'en',
                prompt: {
                    prompt: config.prompt || '',
                    llm: config.llmModel || DEFAULT_MODELS.elevenlabs.llm,
                    temperature: 0,
                },
            },
            tts: {
                model_id: config.voiceModel || DEFAULT_MODELS.elevenlabs.voice,
                voice_id: config.voiceId || ELEVENLABS_DEFAULT_VOICE_ID,
                stability: 0.5,
                similarity_boost: 0.8,
            },
        },
    };

    if (config.postCallWebhookId) {
        body.platform_settings = postCallWebhookSettings(config.postCallWebhookId);
    }

    return elevenlabsFetch<ElevenLabsAgent>(apiKey, '/v1/convai/agents/create', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function listElevenLabsAgents(
    apiKey: string,
): Promise<ElevenLabsAgent[]> {
    const data = await elevenlabsFetch<{ agents: ElevenLabsAgent[] }>(apiKey, '/v1/convai/agents');
    return data.agents ?? [];
}

export async function getElevenLabsAgent(
    apiKey: string,
    agentId: string
): Promise<ElevenLabsAgent> {
    return elevenlabsFetch<ElevenLabsAgent>(apiKey, `/v1/convai/agents/${encodeURIComponent(agentId)}`);
}

export async function updateElevenLabsAgent(
    apiKey: string,
    agentId: string,
    config: {
        name?: string;
        prompt?: string;
        firstMessage?: string;
        llmModel?: string;
        voiceModel?: string;
        voiceId?: string;
        language?: string;
    }
): Promise<ElevenLabsAgent> {
    const body: Record<string, unknown> = {};

    if (config.name !== undefined) {
        body.name = config.name;
    }

    // Build conversation_config only if voice/LLM/prompt fields changed
    const agentSection: Record<string, unknown> = {};
    const ttsSection: Record<string, unknown> = {};
    let hasAgent = false;
    let hasTts = false;

    if (config.prompt !== undefined || config.llmModel !== undefined) {
        const promptObj: Record<string, unknown> = {};
        if (config.prompt !== undefined) promptObj.prompt = config.prompt;
        if (config.llmModel !== undefined) promptObj.llm = config.llmModel;
        agentSection.prompt = promptObj;
        hasAgent = true;
    }

    if (config.firstMessage !== undefined) {
        agentSection.first_message = config.firstMessage;
        hasAgent = true;
    }

    if (config.language !== undefined) {
        agentSection.language = config.language;
        hasAgent = true;
    }

    if (config.voiceModel !== undefined) {
        ttsSection.model_id = config.voiceModel;
        hasTts = true;
    }

    if (config.voiceId !== undefined) {
        ttsSection.voice_id = config.voiceId;
        hasTts = true;
    }

    if (hasAgent || hasTts) {
        body.conversation_config = {
            ...(hasAgent ? { agent: agentSection } : {}),
            ...(hasTts ? { tts: ttsSection } : {}),
        };
    }

    return elevenlabsFetch<ElevenLabsAgent>(apiKey, `/v1/convai/agents/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export async function deleteElevenLabsAgent(
    apiKey: string,
    agentId: string
): Promise<void> {
    await elevenlabsFetch<void>(apiKey, `/v1/convai/agents/${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
    });
}

// ── Post-call Webhooks ──────────────────────────────────────

/** Post-call events we subscribe agents to: full transcript + failed outbound dials */
export const ELEVENLABS_POST_CALL_EVENTS = ['transcript', 'call_initiation_failure'];

/** platform_settings fragment that routes an agent's post-call webhooks to a workspace webhook */
export function postCallWebhookSettings(webhookId: string) {
    return {
        workspace_overrides: {
            webhooks: {
                post_call_webhook_id: webhookId,
                events: ELEVENLABS_POST_CALL_EVENTS,
            },
        },
    };
}

/**
 * Register an HMAC-signed workspace webhook. The secret is only returned here,
 * so the caller must store it.
 */
export async function createElevenLabsWorkspaceWebhook(
    apiKey: string,
    config: { name: string; url: string },
): Promise<{ webhook_id: string; webhook_secret: string | null }> {
    return elevenlabsFetch(apiKey, '/v1/workspace/webhooks', {
        method: 'POST',
        body: JSON.stringify({
            settings: { auth_type: 'hmac', name: config.name, webhook_url: config.url },
        }),
    });
}

/** Point an existing agent's post-call webhooks at a workspace webhook */
export async function setElevenLabsAgentPostCallWebhook(
    apiKey: string,
    agentId: string,
    webhookId: string,
): Promise<void> {
    await elevenlabsFetch<ElevenLabsAgent>(apiKey, `/v1/convai/agents/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ platform_settings: postCallWebhookSettings(webhookId) }),
    });
}

// ── Conversation (Call) Fetching ────────────────────────────

export async function getElevenLabsConversation(
    apiKey: string,
    conversationId: string
): Promise<ElevenLabsConversation> {
    return elevenlabsFetch<ElevenLabsConversation>(
        apiKey,
        `/v1/convai/conversations/${encodeURIComponent(conversationId)}`
    );
}

export async function listElevenLabsConversations(
    apiKey: string,
    params?: {
        agentId?: string;
        pageSize?: number;
        cursor?: string;
    }
): Promise<ElevenLabsListConversationsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.agentId) searchParams.set('agent_id', params.agentId);
    if (params?.pageSize) searchParams.set('page_size', params.pageSize.toString());
    if (params?.cursor) searchParams.set('cursor', params.cursor);

    const queryString = searchParams.toString();
    const path = queryString ? `/v1/convai/conversations?${queryString}` : '/v1/convai/conversations';

    return elevenlabsFetch<ElevenLabsListConversationsResponse>(apiKey, path);
}

/**
 * Convert ElevenLabs transcript array to a flat string (Agent: ...\nUser: ...).
 */
export function flattenElevenLabsTranscript(
    transcript?: ElevenLabsTranscriptTurn[]
): string {
    if (!transcript || transcript.length === 0) return '';
    return transcript
        // Tool-call turns carry no message
        .filter(t => t.message)
        .map(t => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.message}`)
        .join('\n');
}
