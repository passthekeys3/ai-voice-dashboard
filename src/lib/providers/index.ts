/**
 * Unified Voice Provider Interface
 * Abstracts Retell and Vapi behind a common API
 */

import type { VoiceProvider, AgentConfig } from '@/types';
import * as retell from './retell';
import * as vapi from './vapi';
import * as bland from './bland';
import * as elevenlabs from './elevenlabs';
import { DEFAULT_MODELS, vapiModelProvider } from '@/lib/constants/config';

// Normalized agent structure
export interface NormalizedAgent {
    externalId: string;
    name: string;
    provider: VoiceProvider;
    voiceId?: string;
    voiceName?: string;
    config: AgentConfig;
    createdAt: string;
}

// Normalized call structure
export interface NormalizedCall {
    externalId: string;
    agentExternalId: string;
    provider: VoiceProvider;
    status: 'completed' | 'failed' | 'in_progress' | 'queued';
    direction: 'inbound' | 'outbound';
    durationSeconds: number;
    costCents: number;
    fromNumber?: string;
    toNumber?: string;
    transcript?: string;
    audioUrl?: string;
    summary?: string;
    sentiment?: string;
    startedAt: string;
    endedAt?: string;
    metadata?: Record<string, unknown>;
}

// Provider interface
export interface VoiceProviderClient {
    listAgents(): Promise<NormalizedAgent[]>;
    getAgent(agentId: string): Promise<NormalizedAgent>;
    createAgent(config: { name: string; voiceId?: string; prompt?: string }): Promise<NormalizedAgent>;
    updateAgent(agentId: string, config: Partial<{ name: string; voiceId?: string; prompt?: string }>): Promise<NormalizedAgent>;
    deleteAgent(agentId: string): Promise<void>;
    listCalls(filters?: { agentId?: string; limit?: number }): Promise<NormalizedCall[]>;
    getCall(callId: string): Promise<NormalizedCall>;
}

// Retell implementation
function createRetellClient(apiKey: string): VoiceProviderClient {
    const normalizeAgent = (agent: retell.RetellAgent): NormalizedAgent => ({
        externalId: agent.agent_id,
        name: agent.agent_name,
        provider: 'retell',
        voiceId: agent.voice_id,
        config: {
            // Store all Retell agent fields for the editor
            agent_name: agent.agent_name,
            voice_id: agent.voice_id,
            language: agent.language,
            webhook_url: agent.webhook_url,
            webhook_events: agent.webhook_events,
            llm_websocket_url: agent.llm_websocket_url,
            responsiveness: agent.responsiveness,
            interruption_sensitivity: agent.interruption_sensitivity,
            ambient_sound: agent.ambient_sound,
            llm_id: agent.llm_id,
            response_engine: agent.response_engine as Record<string, unknown>,
        },
        createdAt: agent.created_at,
    });

    const normalizeCall = (call: retell.RetellCall): NormalizedCall => {
        const durationSeconds = call.end_timestamp && call.start_timestamp
            ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
            : 0;

        let status: NormalizedCall['status'] = 'queued';
        if (call.call_status === 'ended') status = 'completed';
        else if (call.call_status === 'error') status = 'failed';
        else if (call.call_status === 'ongoing') status = 'in_progress';

        return {
            externalId: call.call_id,
            agentExternalId: call.agent_id,
            provider: 'retell',
            status,
            direction: call.direction || 'outbound',
            durationSeconds,
            // Retell combined_cost is already in cents
            costCents: Math.round(call.call_cost?.combined_cost || 0),
            fromNumber: call.from_number,
            toNumber: call.to_number,
            transcript: call.transcript,
            audioUrl: call.recording_url,
            summary: call.call_analysis?.call_summary,
            sentiment: call.call_analysis?.user_sentiment,
            startedAt: new Date(call.start_timestamp).toISOString(),
            endedAt: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : undefined,
            metadata: call.metadata,
        };
    };

    return {
        async listAgents() {
            const agents = await retell.listRetellAgents(apiKey);
            return agents.map(normalizeAgent);
        },
        async getAgent(agentId) {
            const agent = await retell.getRetellAgent(apiKey, agentId);
            return normalizeAgent(agent);
        },
        async createAgent(config) {
            const agent = await retell.createRetellAgent(apiKey, {
                agent_name: config.name,
                voice_id: config.voiceId || '11labs-Adrian',
            });
            return normalizeAgent(agent);
        },
        async updateAgent(agentId, config) {
            const agent = await retell.updateRetellAgent(apiKey, agentId, {
                agent_name: config.name,
                voice_id: config.voiceId,
            });
            return normalizeAgent(agent);
        },
        async deleteAgent(agentId) {
            await retell.deleteRetellAgent(apiKey, agentId);
        },
        async listCalls(filters) {
            const calls = await retell.listRetellCalls(apiKey, {
                filter_criteria: filters?.agentId ? { agent_id: [filters.agentId] } : undefined,
                limit: filters?.limit || 100,
                sort_order: 'descending',
            });
            return calls.map(normalizeCall);
        },
        async getCall(callId) {
            const call = await retell.getRetellCall(apiKey, callId);
            return normalizeCall(call);
        },
    };
}

// Vapi implementation
function createVapiClient(apiKey: string): VoiceProviderClient {
    const normalizeAgent = (assistant: vapi.VapiAssistant): NormalizedAgent => ({
        externalId: assistant.id,
        name: assistant.name,
        provider: 'vapi',
        voiceId: assistant.voice?.voiceId,
        config: {
            voice_id: assistant.voice?.voiceId,
            prompt: vapi.extractVapiSystemPrompt(assistant.model),
            webhook_url: assistant.server?.url,
            metadata: assistant.metadata,
        },
        createdAt: assistant.createdAt,
    });

    const normalizeCall = (call: vapi.VapiCall): NormalizedCall => {
        const startedAt = call.startedAt || call.createdAt;
        const endedAt = call.endedAt;
        const durationSeconds = startedAt && endedAt
            ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
            : 0;

        let status: NormalizedCall['status'] = 'queued';
        if (call.status === 'ended') status = 'completed';
        else if (call.status === 'in-progress' || call.status === 'forwarding') status = 'in_progress';
        else if (call.status === 'queued' || call.status === 'ringing') status = 'queued';

        const direction: 'inbound' | 'outbound' =
            call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

        return {
            externalId: call.id,
            agentExternalId: call.assistantId,
            provider: 'vapi',
            status,
            direction,
            durationSeconds,
            costCents: call.cost ? Math.round(call.cost * 100) : 0,
            fromNumber: call.customer?.number,
            toNumber: call.phoneNumber?.number,
            transcript: call.transcript,
            audioUrl: call.recordingUrl,
            summary: call.summary || call.analysis?.summary,
            sentiment: undefined,
            startedAt,
            endedAt,
            metadata: call.metadata,
        };
    };

    return {
        async listAgents() {
            const assistants = await vapi.listVapiAssistants(apiKey);
            return assistants.map(normalizeAgent);
        },
        async getAgent(agentId) {
            const assistant = await vapi.getVapiAssistant(apiKey, agentId);
            return normalizeAgent(assistant);
        },
        async createAgent(config) {
            const assistant = await vapi.createVapiAssistant(apiKey, {
                name: config.name,
                model: config.prompt ? {
                    provider: vapiModelProvider(DEFAULT_MODELS.vapi.llm),
                    model: DEFAULT_MODELS.vapi.llm,
                    messages: vapi.withVapiSystemPrompt(undefined, config.prompt),
                } : undefined,
                // Ensure webhook delivery points to our Vapi webhook handler
                server: process.env.NEXT_PUBLIC_APP_URL
                    ? { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/vapi` }
                    : undefined,
            });
            return normalizeAgent(assistant);
        },
        async updateAgent(agentId, config) {
            const currentAssistant = await vapi.getVapiAssistant(apiKey, agentId);
            const updateData: Record<string, unknown> = {};
            if (config.name !== undefined) updateData.name = config.name;
            if (config.prompt !== undefined) {
                const modelName = currentAssistant.model?.model || DEFAULT_MODELS.vapi.llm;
                updateData.model = {
                    provider: currentAssistant.model?.provider || vapiModelProvider(modelName),
                    model: modelName,
                    messages: vapi.withVapiSystemPrompt(currentAssistant.model?.messages, config.prompt),
                    ...(currentAssistant.model?.temperature !== undefined ? { temperature: currentAssistant.model.temperature } : {}),
                };
            }
            if (config.voiceId !== undefined) {
                updateData.voice = {
                    provider: currentAssistant.voice?.provider || 'openai',
                    voiceId: config.voiceId,
                };
            }
            const assistant = await vapi.updateVapiAssistant(apiKey, agentId, updateData);
            return normalizeAgent(assistant);
        },
        async deleteAgent(agentId) {
            await vapi.deleteVapiAssistant(apiKey, agentId);
        },
        async listCalls(filters) {
            const calls = await vapi.listVapiCalls(apiKey, {
                assistantId: filters?.agentId,
                limit: filters?.limit || 100,
            });
            return calls.map(normalizeCall);
        },
        async getCall(callId) {
            const call = await vapi.getVapiCall(apiKey, callId);
            return normalizeCall(call);
        },
    };
}

// Bland implementation
function createBlandClient(apiKey: string): VoiceProviderClient {
    const normalizeAgent = (pathway: bland.BlandPathway): NormalizedAgent => ({
        externalId: pathway.id,
        name: pathway.name,
        provider: 'bland',
        config: {
            description: pathway.description,
        } as AgentConfig,
        createdAt: pathway.created_at || new Date().toISOString(),
    });

    const normalizeCall = (call: bland.BlandCall): NormalizedCall => {
        // Bland uses minutes for call_length, convert to seconds
        const durationSeconds = call.call_length
            ? Math.round(call.call_length * 60)
            : 0;

        let status: NormalizedCall['status'] = 'queued';
        if (call.completed || call.status === 'completed' || call.status === 'complete') status = 'completed';
        else if (call.status === 'in-progress' || call.queue_status === 'in-progress') status = 'in_progress';
        else if (call.status === 'error') status = 'failed';

        return {
            externalId: call.call_id,
            agentExternalId: call.pathway_id || '',
            provider: 'bland',
            status,
            direction: 'outbound', // Bland inbound is configured per-number
            durationSeconds,
            // Bland uses dollars for price, convert to cents
            costCents: call.price ? Math.round(call.price * 100) : 0,
            fromNumber: call.from,
            toNumber: call.to,
            transcript: call.concatenated_transcript,
            audioUrl: call.recording_url,
            summary: call.summary,
            sentiment: undefined,
            startedAt: call.started_at || call.created_at || new Date().toISOString(),
            endedAt: call.end_at,
            metadata: call.variables || call.metadata,
        };
    };

    return {
        async listAgents() {
            const pathways = await bland.listBlandPathways(apiKey);
            return pathways.map(normalizeAgent);
        },
        async getAgent(agentId) {
            const pathway = await bland.getBlandPathway(apiKey, agentId);
            return normalizeAgent(pathway);
        },
        async createAgent(config) {
            const pathway = await bland.createBlandPathway(apiKey, {
                name: config.name,
                description: config.prompt,
            });
            return normalizeAgent(pathway);
        },
        async updateAgent(agentId, config) {
            const updateData: Record<string, unknown> = {};
            if (config.name !== undefined) updateData.name = config.name;
            if (config.prompt !== undefined) updateData.description = config.prompt;
            const pathway = await bland.updateBlandPathway(apiKey, agentId, updateData);
            return normalizeAgent(pathway);
        },
        async deleteAgent(agentId) {
            await bland.deleteBlandPathway(apiKey, agentId);
        },
        async listCalls(filters) {
            const calls = await bland.listBlandCalls(apiKey, {
                pathway_id: filters?.agentId,
                limit: filters?.limit || 100,
            });
            return calls.map(normalizeCall);
        },
        async getCall(callId) {
            const call = await bland.getBlandCall(apiKey, callId);
            return normalizeCall(call);
        },
    };
}

// ElevenLabs implementation
function createElevenLabsClient(apiKey: string): VoiceProviderClient {
    const normalizeAgent = (agent: elevenlabs.ElevenLabsAgent): NormalizedAgent => ({
        externalId: agent.agent_id,
        name: agent.name || 'Unnamed Agent',
        provider: 'elevenlabs',
        voiceId: agent.conversation_config?.tts?.voice_id,
        config: {
            voice_id: agent.conversation_config?.tts?.voice_id,
            prompt: agent.conversation_config?.agent?.prompt?.prompt,
            language: agent.conversation_config?.agent?.language,
        } as AgentConfig,
        createdAt: agent.metadata?.created_at_unix_secs
            ? new Date(agent.metadata.created_at_unix_secs * 1000).toISOString()
            : new Date().toISOString(),
    });

    const normalizeStatus = (status: elevenlabs.ElevenLabsConversation['status']): NormalizedCall['status'] => {
        if (status === 'done') return 'completed';
        if (status === 'failed') return 'failed';
        if (status === 'in-progress' || status === 'processing') return 'in_progress';
        return 'queued';
    };

    const toIso = (unixSecs?: number, offsetSecs = 0) =>
        unixSecs ? new Date((unixSecs + offsetSecs) * 1000).toISOString() : undefined;

    // List endpoint returns summaries (no transcript or cost)
    const normalizeSummary = (conv: elevenlabs.ElevenLabsConversationSummary): NormalizedCall => {
        const durationSeconds = conv.call_duration_secs || 0;
        return {
            externalId: conv.conversation_id,
            agentExternalId: conv.agent_id,
            provider: 'elevenlabs',
            status: normalizeStatus(conv.status),
            direction: conv.direction ?? 'inbound',
            durationSeconds,
            costCents: 0,
            summary: conv.transcript_summary || undefined,
            sentiment: undefined,
            startedAt: toIso(conv.start_time_unix_secs) ?? new Date().toISOString(),
            endedAt: toIso(conv.start_time_unix_secs, durationSeconds),
        };
    };

    const normalizeCall = (conv: elevenlabs.ElevenLabsConversation): NormalizedCall => {
        const meta = conv.metadata ?? {};
        const durationSeconds = meta.call_duration_secs || 0;
        return {
            externalId: conv.conversation_id,
            agentExternalId: conv.agent_id,
            provider: 'elevenlabs',
            status: normalizeStatus(conv.status),
            direction: meta.phone_call?.direction ?? 'inbound',
            durationSeconds,
            costCents: meta.cost_fiat ? Math.round(meta.cost_fiat * 100) : 0,
            transcript: elevenlabs.flattenElevenLabsTranscript(conv.transcript),
            summary: conv.analysis?.transcript_summary || undefined,
            sentiment: undefined,
            startedAt: toIso(meta.start_time_unix_secs) ?? new Date().toISOString(),
            endedAt: toIso(meta.start_time_unix_secs, durationSeconds),
            metadata: meta,
        };
    };

    return {
        async listAgents() {
            const agents = await elevenlabs.listElevenLabsAgents(apiKey);
            return agents.map(normalizeAgent);
        },
        async getAgent(agentId) {
            const agent = await elevenlabs.getElevenLabsAgent(apiKey, agentId);
            return normalizeAgent(agent);
        },
        async createAgent(config) {
            const agent = await elevenlabs.createElevenLabsAgent(apiKey, {
                name: config.name,
                voiceId: config.voiceId,
                prompt: config.prompt,
            });
            return normalizeAgent(agent);
        },
        async updateAgent(agentId, config) {
            const agent = await elevenlabs.updateElevenLabsAgent(apiKey, agentId, {
                name: config.name,
                voiceId: config.voiceId,
                prompt: config.prompt,
            });
            return normalizeAgent(agent);
        },
        async deleteAgent(agentId) {
            await elevenlabs.deleteElevenLabsAgent(apiKey, agentId);
        },
        async listCalls(filters) {
            const result = await elevenlabs.listElevenLabsConversations(apiKey, {
                agentId: filters?.agentId,
                pageSize: filters?.limit || 100,
            });
            return result.conversations.map(normalizeSummary);
        },
        async getCall(callId) {
            const conv = await elevenlabs.getElevenLabsConversation(apiKey, callId);
            return normalizeCall(conv);
        },
    };
}

// Factory function
export function getProviderClient(
    provider: VoiceProvider,
    apiKey: string
): VoiceProviderClient {
    switch (provider) {
        case 'retell':
            return createRetellClient(apiKey);
        case 'vapi':
            return createVapiClient(apiKey);
        case 'bland':
            return createBlandClient(apiKey);
        case 'elevenlabs':
            return createElevenLabsClient(apiKey);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

