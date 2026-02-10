/**
 * Retrieve an agent's system prompt from the voice provider (Retell, Vapi, or Bland).
 * Falls back to locally stored config if provider API fails.
 */

import { getRetellAgent, getRetellLLM } from '@/lib/providers/retell';
import { getVapiAssistant } from '@/lib/providers/vapi';
import { getBlandPathway } from '@/lib/providers/bland';
import type { AgentConfig } from '@/types';

export interface AgentPromptResult {
    prompt: string;
    firstMessage?: string;
}

export async function getAgentPrompt(params: {
    provider: 'retell' | 'vapi' | 'bland';
    apiKey: string;
    externalId: string;
    localConfig?: AgentConfig;
}): Promise<AgentPromptResult | null> {
    const { provider, apiKey, externalId, localConfig } = params;

    try {
        if (provider === 'retell') {
            const agent = await getRetellAgent(apiKey, externalId);

            // Retell stores prompts on the LLM, not the agent
            const llmId = agent.llm_id || agent.response_engine?.llm_id;
            if (llmId) {
                const llm = await getRetellLLM(apiKey, llmId);
                if (llm.general_prompt) {
                    return {
                        prompt: llm.general_prompt,
                        firstMessage: llm.begin_message || undefined,
                    };
                }
            }
        } else if (provider === 'vapi') {
            const assistant = await getVapiAssistant(apiKey, externalId);
            if (assistant.model?.systemPrompt) {
                return {
                    prompt: assistant.model.systemPrompt,
                    firstMessage: assistant.firstMessage || undefined,
                };
            }
        } else if (provider === 'bland') {
            // Bland stores the prompt as the pathway description
            const pathway = await getBlandPathway(apiKey, externalId);
            if (pathway.description) {
                return {
                    prompt: pathway.description,
                };
            }
        }
    } catch (error) {
        console.error(`Failed to fetch prompt from ${provider}:`, error instanceof Error ? error.message : error);
    }

    // Fallback to local config
    if (localConfig) {
        const prompt = (localConfig.prompt as string)
            || (localConfig.llm_prompt as string)
            || (localConfig.system_prompt as string);
        if (prompt) {
            return { prompt };
        }
    }

    return null;
}
