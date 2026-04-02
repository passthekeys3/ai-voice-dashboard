import { NextRequest, NextResponse } from 'next/server';
import type { VoiceProvider } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { updateRetellAgent, getRetellAgent, getRetellLLM, updateRetellLLM, type UpdateRetellLLMParams } from '@/lib/providers/retell';
import { getVapiAssistant, updateVapiAssistant, extractVapiSystemPrompt, usesVapiMessagesFormat } from '@/lib/providers/vapi';
import { getBlandPathway, updateBlandPathway } from '@/lib/providers/bland';
import { getElevenLabsAgent, updateElevenLabsAgent } from '@/lib/providers/elevenlabs';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { isValidUuid } from '@/lib/validation';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = await createClient();

        // Get the agent
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('external_id, provider, config, client_id')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Client users can only access their own agents
        if (!isAgencyAdmin(user) && agent.client_id !== user.client?.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Resolve API keys (client key → agency key fallback)
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
        }

        // Fetch from provider
        if (agent.provider === 'retell') {
            try {
                const retellAgent = await getRetellAgent(apiKey, agent.external_id);

                // Get LLM details if agent has a response_engine with llm_id
                let llmPrompt = '';
                let llmId = '';
                let llmModel = '';

                if (retellAgent.response_engine?.type === 'retell-llm' && retellAgent.response_engine.llm_id) {
                    llmId = retellAgent.response_engine.llm_id;
                    try {
                        const llm = await getRetellLLM(apiKey, llmId);
                        llmPrompt = llm.general_prompt || '';
                        llmModel = llm.model || '';
                    } catch (err) {
                        console.error('Error fetching LLM:', err instanceof Error ? err.message : 'Unknown error');
                    }
                }

                return NextResponse.json({
                    data: {
                        agent_name: retellAgent.agent_name,
                        voice_id: retellAgent.voice_id,
                        voice_model: retellAgent.voice_model || agent.config?.voice_model || '',
                        language: retellAgent.language,
                        responsiveness: retellAgent.responsiveness,
                        llm_id: llmId,
                        llm_model: llmModel || agent.config?.llm_model || '',
                        prompt: llmPrompt,
                        enable_safety_guardrails: retellAgent.enable_safety_guardrails ?? false,
                        safety_guardrails_categories: retellAgent.safety_guardrails_categories ?? [],
                    }
                });
            } catch (err) {
                console.error('Error fetching Retell agent:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json({ error: 'Failed to fetch from provider' }, { status: 500 });
            }
        } else if (agent.provider === 'vapi') {
            try {
                const vapiAssistant = await getVapiAssistant(apiKey, agent.external_id);

                return NextResponse.json({
                    data: {
                        agent_name: vapiAssistant.name,
                        voice_id: vapiAssistant.voice?.voiceId || '',
                        voice_provider: vapiAssistant.voice?.provider || '',
                        language: vapiAssistant.transcriber?.language || 'en',
                        prompt: extractVapiSystemPrompt(vapiAssistant.model),
                        model_provider: vapiAssistant.model?.provider || '',
                        model: vapiAssistant.model?.model || '',
                        first_message: vapiAssistant.firstMessage || '',
                    }
                });
            } catch (err) {
                console.error('Error fetching Vapi assistant:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json({ error: 'Failed to fetch from provider' }, { status: 500 });
            }
        } else if (agent.provider === 'bland') {
            try {
                const pathway = await getBlandPathway(apiKey, agent.external_id);

                return NextResponse.json({
                    data: {
                        agent_name: pathway.name,
                        prompt: pathway.description || '',
                    }
                });
            } catch (err) {
                console.error('Error fetching Bland pathway:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json({ error: 'Failed to fetch from provider' }, { status: 500 });
            }
        } else if (agent.provider === 'elevenlabs') {
            try {
                const elAgent = await getElevenLabsAgent(apiKey, agent.external_id);
                const convConfig = elAgent.conversation_config;

                return NextResponse.json({
                    data: {
                        agent_name: elAgent.name || '',
                        voice_id: convConfig?.tts?.voice_id || '',
                        voice_model: convConfig?.tts?.model_id || agent.config?.voice_model || '',
                        language: convConfig?.agent?.language || 'en',
                        prompt: convConfig?.agent?.prompt?.prompt || '',
                        llm_model: convConfig?.agent?.prompt?.llm || agent.config?.llm_model || '',
                        first_message: convConfig?.agent?.first_message || '',
                    }
                });
            } catch (err) {
                console.error('Error fetching ElevenLabs agent:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json({ error: 'Failed to fetch from provider' }, { status: 500 });
            }
        }

        return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
    } catch (error) {
        console.error('Error fetching agent provider data:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const body = await request.json();

        const supabase = await createClient();

        // Get the agent
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('external_id, provider, config, client_id')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Resolve API keys (client key → agency key fallback).
        // When a client assignment is changing, the caller passes _original_client_id
        // so we resolve keys from the workspace where the agent's external_id exists.
        const keyResolutionClientId = body._original_client_id !== undefined
            ? body._original_client_id   // Client assignment is changing — use original keys
            : agent.client_id;           // Normal update — use current keys
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, keyResolutionClientId);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
        }

        // Update on provider
        if (agent.provider === 'retell') {
            try {
                // First, get the current agent to find LLM ID
                const retellAgent = await getRetellAgent(apiKey, agent.external_id);

                // Update agent settings (name, voice, language, responsiveness, guardrails)
                const updateData: Record<string, unknown> = {};
                if (body.agent_name !== undefined) updateData.agent_name = body.agent_name;
                if (body.voice_id !== undefined) updateData.voice_id = body.voice_id;
                if (body.voice_model !== undefined) updateData.voice_model = body.voice_model;
                if (body.language !== undefined) updateData.language = body.language;
                if (body.responsiveness !== undefined) updateData.responsiveness = body.responsiveness;
                if (body.enable_safety_guardrails !== undefined) updateData.enable_safety_guardrails = body.enable_safety_guardrails;
                if (body.safety_guardrails_categories !== undefined) updateData.safety_guardrails_categories = body.safety_guardrails_categories;

                if (Object.keys(updateData).length > 0) {
                    await updateRetellAgent(apiKey, agent.external_id, updateData);
                }

                // Update LLM prompt and/or model if provided
                if (retellAgent.response_engine?.llm_id) {
                    const llmUpdate: UpdateRetellLLMParams = {};
                    if (body.prompt !== undefined) llmUpdate.general_prompt = body.prompt;
                    if (body.llm_model !== undefined) llmUpdate.model = body.llm_model;
                    if (Object.keys(llmUpdate).length > 0) {
                        await updateRetellLLM(apiKey, retellAgent.response_engine.llm_id, llmUpdate);
                    }
                }

                // Store in local config (use !== undefined checks to allow clearing values)
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name !== undefined ? body.agent_name : agent.config?.agent_name,
                    voice_id: body.voice_id !== undefined ? body.voice_id : agent.config?.voice_id,
                    voice_model: body.voice_model !== undefined ? body.voice_model : agent.config?.voice_model,
                    language: body.language !== undefined ? body.language : agent.config?.language,
                    responsiveness: body.responsiveness !== undefined ? body.responsiveness : agent.config?.responsiveness,
                    llm_prompt: body.prompt !== undefined ? body.prompt : agent.config?.llm_prompt,
                    llm_model: body.llm_model !== undefined ? body.llm_model : agent.config?.llm_model,
                    llm_id: retellAgent.response_engine?.llm_id,
                    enable_safety_guardrails: body.enable_safety_guardrails !== undefined ? body.enable_safety_guardrails : agent.config?.enable_safety_guardrails,
                    safety_guardrails_categories: body.safety_guardrails_categories !== undefined ? body.safety_guardrails_categories : agent.config?.safety_guardrails_categories,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        ...(body.agent_name !== undefined ? { name: body.agent_name } : {}),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)
                    .eq('agency_id', user.agency.id);

            } catch (err) {
                console.error('Error updating Retell agent:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json(
                    { error: 'Failed to update agent on provider' },
                    { status: 500 }
                );
            }
        } else if (agent.provider === 'vapi') {
            try {
                // Fetch current assistant to preserve existing config structures
                const vapiAssistant = await getVapiAssistant(apiKey, agent.external_id);

                const updateData: Partial<{
                    name: string;
                    model: { provider: string; model: string; systemPrompt?: string; messages?: Array<{ role: string; content: string }>; temperature?: number };
                    voice: { provider: string; voiceId: string; speed?: number; stability?: number };
                    transcriber: { provider: string; model?: string; language?: string };
                    firstMessage: string;
                }> = {};

                if (body.agent_name !== undefined) updateData.name = body.agent_name;

                // Update model config (prompt, model selection, or both)
                if (body.prompt !== undefined || body.model !== undefined || body.model_provider !== undefined) {
                    const useMessages = usesVapiMessagesFormat(vapiAssistant.model);
                    const currentPrompt = extractVapiSystemPrompt(vapiAssistant.model);
                    const newPrompt = body.prompt !== undefined ? body.prompt : currentPrompt;

                    updateData.model = {
                        provider: body.model_provider !== undefined ? body.model_provider : (vapiAssistant.model?.provider || 'openai'),
                        model: body.model !== undefined ? body.model : (vapiAssistant.model?.model || 'gpt-4o'),
                        ...(vapiAssistant.model?.temperature !== undefined ? { temperature: vapiAssistant.model.temperature } : {}),
                    };

                    if (useMessages) {
                        // Assistant uses messages array format — update system message in place
                        const existingMessages = vapiAssistant.model?.messages || [];
                        const hasSystemMsg = existingMessages.some(m => m.role === 'system');
                        updateData.model.messages = hasSystemMsg
                            ? existingMessages.map(m => m.role === 'system' ? { ...m, content: newPrompt } : m)
                            : [{ role: 'system', content: newPrompt }, ...existingMessages];
                    } else {
                        // Assistant uses legacy systemPrompt field
                        updateData.model.systemPrompt = newPrompt;
                    }
                }

                // Update voice config
                if (body.voice_id !== undefined || body.voice_provider !== undefined) {
                    updateData.voice = {
                        provider: body.voice_provider !== undefined ? body.voice_provider : (vapiAssistant.voice?.provider || 'openai'),
                        voiceId: body.voice_id !== undefined ? body.voice_id : (vapiAssistant.voice?.voiceId || ''),
                        ...(vapiAssistant.voice?.speed !== undefined ? { speed: vapiAssistant.voice.speed } : {}),
                        ...(vapiAssistant.voice?.stability !== undefined ? { stability: vapiAssistant.voice.stability } : {}),
                    };
                }

                // Update transcriber language
                if (body.language !== undefined) {
                    updateData.transcriber = {
                        provider: vapiAssistant.transcriber?.provider || 'deepgram',
                        model: vapiAssistant.transcriber?.model,
                        language: body.language,
                    };
                }

                if (body.first_message !== undefined) updateData.firstMessage = body.first_message;

                if (Object.keys(updateData).length > 0) {
                    await updateVapiAssistant(apiKey, agent.external_id, updateData);
                }

                // Store in local config (use !== undefined checks to allow clearing values)
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name !== undefined ? body.agent_name : agent.config?.agent_name,
                    prompt: body.prompt !== undefined ? body.prompt : agent.config?.prompt,
                    voice_id: body.voice_id !== undefined ? body.voice_id : agent.config?.voice_id,
                    voice_provider: body.voice_provider !== undefined ? body.voice_provider : agent.config?.voice_provider,
                    language: body.language !== undefined ? body.language : agent.config?.language,
                    model_provider: body.model_provider !== undefined ? body.model_provider : agent.config?.model_provider,
                    model: body.model !== undefined ? body.model : agent.config?.model,
                    first_message: body.first_message !== undefined ? body.first_message : agent.config?.first_message,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        ...(body.agent_name !== undefined ? { name: body.agent_name } : {}),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)
                    .eq('agency_id', user.agency.id);

            } catch (err) {
                console.error('Error updating Vapi assistant:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json(
                    { error: 'Failed to update agent on provider' },
                    { status: 500 }
                );
            }
        } else if (agent.provider === 'bland') {
            try {
                const updateData: Partial<{ name: string; description: string }> = {};

                if (body.agent_name !== undefined) updateData.name = body.agent_name;
                if (body.prompt !== undefined) updateData.description = body.prompt;

                if (Object.keys(updateData).length > 0) {
                    await updateBlandPathway(apiKey, agent.external_id, updateData);
                }

                // Store in local config (use !== undefined checks to allow clearing values)
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name !== undefined ? body.agent_name : agent.config?.agent_name,
                    prompt: body.prompt !== undefined ? body.prompt : agent.config?.prompt,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        ...(body.agent_name !== undefined ? { name: body.agent_name } : {}),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)
                    .eq('agency_id', user.agency.id);

            } catch (err) {
                console.error('Error updating Bland pathway:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json(
                    { error: 'Failed to update agent on provider' },
                    { status: 500 }
                );
            }
        } else if (agent.provider === 'elevenlabs') {
            try {
                const updateData: Parameters<typeof updateElevenLabsAgent>[2] = {};

                if (body.agent_name !== undefined) updateData.name = body.agent_name;
                if (body.prompt !== undefined) updateData.prompt = body.prompt;
                if (body.first_message !== undefined) updateData.firstMessage = body.first_message;
                if (body.llm_model !== undefined) updateData.llmModel = body.llm_model;
                if (body.voice_model !== undefined) updateData.voiceModel = body.voice_model;
                if (body.voice_id !== undefined) updateData.voiceId = body.voice_id;
                if (body.language !== undefined) updateData.language = body.language;

                if (Object.keys(updateData).length > 0) {
                    await updateElevenLabsAgent(apiKey, agent.external_id, updateData);
                }

                // Store in local config
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name !== undefined ? body.agent_name : agent.config?.agent_name,
                    prompt: body.prompt !== undefined ? body.prompt : agent.config?.prompt,
                    first_message: body.first_message !== undefined ? body.first_message : agent.config?.first_message,
                    llm_model: body.llm_model !== undefined ? body.llm_model : agent.config?.llm_model,
                    voice_model: body.voice_model !== undefined ? body.voice_model : agent.config?.voice_model,
                    voice_id: body.voice_id !== undefined ? body.voice_id : agent.config?.voice_id,
                    language: body.language !== undefined ? body.language : agent.config?.language,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        ...(body.agent_name !== undefined ? { name: body.agent_name } : {}),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)
                    .eq('agency_id', user.agency.id);

            } catch (err) {
                console.error('Error updating ElevenLabs agent:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json(
                    { error: 'Failed to update agent on provider' },
                    { status: 500 }
                );
            }
        } else {
            return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating agent on provider:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
