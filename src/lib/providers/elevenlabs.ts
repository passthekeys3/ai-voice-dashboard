/**
 * ElevenLabs Conversational AI API Client
 * https://elevenlabs.io/docs/api-reference/agents
 */

import { fetchWithRetry } from '@/lib/retry';

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
    };
    metadata?: {
        created_at_unix_secs?: number;
        updated_at_unix_secs?: number;
    };
}

export interface ElevenLabsConversation {
    conversation_id: string;
    agent_id: string;
    status: 'processing' | 'done' | 'failed';
    start_time_unix_secs?: number;
    end_time_unix_secs?: number;
    duration_secs?: number;
    cost?: number;
    transcript?: Array<{
        role: 'agent' | 'user';
        message: string;
        time_in_call_secs?: number;
    }>;
    analysis?: {
        evaluation_criteria_results?: Record<string, unknown>;
        data_collection_results?: Record<string, unknown>;
        call_successful?: string;
    };
    metadata?: Record<string, unknown>;
}

export interface ElevenLabsListConversationsResponse {
    conversations: ElevenLabsConversation[];
    has_more: boolean;
    last_evaluated_key?: string;
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
        webhookUrl?: string;
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
                    llm: config.llmModel || 'gemini-2.5-flash',
                    temperature: 0,
                },
            },
            tts: {
                model_id: config.voiceModel || 'eleven_flash_v2',
                voice_id: config.voiceId || 'cjVigY5qzO86Huf0OWal',
                stability: 0.5,
                similarity_boost: 0.8,
            },
        },
    };

    // Set webhook URL if provided
    if (config.webhookUrl) {
        (body as Record<string, unknown>).platform_settings = {
            webhook: {
                url: config.webhookUrl,
                events: ['conversation.ended'],
            },
        };
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
    transcript?: ElevenLabsConversation['transcript']
): string {
    if (!transcript || transcript.length === 0) return '';
    return transcript
        .map(t => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.message}`)
        .join('\n');
}
