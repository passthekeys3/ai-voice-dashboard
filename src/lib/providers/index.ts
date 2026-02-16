/**
 * Unified Voice Provider Interface
 * Abstracts Retell and Vapi behind a common API
 */

import type { VoiceProvider, AgentConfig } from '@/types';
import * as retell from './retell';
import * as vapi from './vapi';
import * as bland from './bland';

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
            costCents: Math.round((call.call_cost?.combined_cost || 0) * 100),
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
            prompt: assistant.model?.systemPrompt,
            webhook_url: assistant.serverUrl,
            metadata: assistant.metadata,
        },
        createdAt: assistant.createdAt,
    });

    const normalizeCall = (call: vapi.VapiCall): NormalizedCall => {
        const startedAt = call.startedAt || call.createdAt;
        const endedAt = call.endedAt;
        const durationSeconds = startedAt && endedAt
            ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
            : 0;

        let status: NormalizedCall['status'] = 'queued';
        if (call.status === 'ended') status = 'completed';
        else if (call.status === 'in-progress') status = 'in_progress';
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
                    provider: 'openai',
                    model: 'gpt-4',
                    systemPrompt: config.prompt,
                } : undefined,
            });
            return normalizeAgent(assistant);
        },
        async updateAgent(agentId, config) {
            const assistant = await vapi.updateVapiAssistant(apiKey, agentId, {
                name: config.name,
            });
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
            startedAt: call.started_at || call.created_at,
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
            const pathway = await bland.updateBlandPathway(apiKey, agentId, {
                name: config.name,
            });
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
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

// Get all providers for an agency
export function getAgencyProviders(agency: {
    retell_api_key?: string;
    vapi_api_key?: string;
    bland_api_key?: string;
}): { provider: VoiceProvider; client: VoiceProviderClient }[] {
    const providers: { provider: VoiceProvider; client: VoiceProviderClient }[] = [];

    if (agency.retell_api_key) {
        providers.push({
            provider: 'retell',
            client: createRetellClient(agency.retell_api_key),
        });
    }

    if (agency.vapi_api_key) {
        providers.push({
            provider: 'vapi',
            client: createVapiClient(agency.vapi_api_key),
        });
    }

    if (agency.bland_api_key) {
        providers.push({
            provider: 'bland',
            client: createBlandClient(agency.bland_api_key),
        });
    }

    return providers;
}
