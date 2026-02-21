import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { updateRetellAgent, getRetellAgent, getRetellLLM, updateRetellLLM } from '@/lib/providers/retell';
import { getVapiAssistant, updateVapiAssistant } from '@/lib/providers/vapi';
import { getBlandPathway, updateBlandPathway } from '@/lib/providers/bland';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';

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
        const supabase = createServiceClient();

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

        // Resolve API keys (client key → agency key fallback)
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as 'retell' | 'vapi' | 'bland');

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

                if (retellAgent.response_engine?.type === 'retell-llm' && retellAgent.response_engine.llm_id) {
                    llmId = retellAgent.response_engine.llm_id;
                    try {
                        const llm = await getRetellLLM(apiKey, llmId);
                        llmPrompt = llm.general_prompt || '';
                    } catch (err) {
                        console.error('Error fetching LLM:', err);
                    }
                }

                return NextResponse.json({
                    data: {
                        agent_name: retellAgent.agent_name,
                        voice_id: retellAgent.voice_id,
                        language: retellAgent.language,
                        responsiveness: retellAgent.responsiveness,
                        llm_id: llmId,
                        prompt: llmPrompt,
                    }
                });
            } catch (err) {
                console.error('Error fetching Retell agent:', err);
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
                        prompt: vapiAssistant.model?.systemPrompt || '',
                        model_provider: vapiAssistant.model?.provider || '',
                        model: vapiAssistant.model?.model || '',
                        first_message: vapiAssistant.firstMessage || '',
                    }
                });
            } catch (err) {
                console.error('Error fetching Vapi assistant:', err);
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
                console.error('Error fetching Bland pathway:', err);
                return NextResponse.json({ error: 'Failed to fetch from provider' }, { status: 500 });
            }
        }

        return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
    } catch (error) {
        console.error('Error fetching agent provider data:', error);
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
        const body = await request.json();

        const supabase = createServiceClient();

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

        // Resolve API keys (client key → agency key fallback)
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as 'retell' | 'vapi' | 'bland');

        if (!apiKey) {
            return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
        }

        // Update on provider
        if (agent.provider === 'retell') {
            try {
                // First, get the current agent to find LLM ID
                const retellAgent = await getRetellAgent(apiKey, agent.external_id);

                // Update agent settings (name, voice, language, responsiveness)
                const updateData: Record<string, unknown> = {};
                if (body.agent_name) updateData.agent_name = body.agent_name;
                if (body.voice_id) updateData.voice_id = body.voice_id;
                if (body.language) updateData.language = body.language;
                if (body.responsiveness !== undefined) updateData.responsiveness = body.responsiveness;

                if (Object.keys(updateData).length > 0) {
                    await updateRetellAgent(apiKey, agent.external_id, updateData);
                }

                // Update LLM prompt if provided
                if (body.prompt && retellAgent.response_engine?.llm_id) {
                    await updateRetellLLM(apiKey, retellAgent.response_engine.llm_id, { general_prompt: body.prompt });
                }

                // Store in local config
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name || agent.config?.agent_name,
                    voice_id: body.voice_id || agent.config?.voice_id,
                    language: body.language || agent.config?.language,
                    responsiveness: body.responsiveness ?? agent.config?.responsiveness,
                    llm_prompt: body.prompt || agent.config?.llm_prompt,
                    llm_id: retellAgent.response_engine?.llm_id,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id);

            } catch (err) {
                console.error('Error updating Retell agent:', err);
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
                    model: { provider: string; model: string; systemPrompt?: string; temperature?: number };
                    voice: { provider: string; voiceId: string; speed?: number; stability?: number };
                    transcriber: { provider: string; model?: string; language?: string };
                    firstMessage: string;
                }> = {};

                if (body.agent_name) updateData.name = body.agent_name;

                // Update model config (prompt, model selection, or both)
                if (body.prompt || body.model || body.model_provider) {
                    updateData.model = {
                        provider: body.model_provider || vapiAssistant.model?.provider || 'openai',
                        model: body.model || vapiAssistant.model?.model || 'gpt-4o',
                        systemPrompt: body.prompt || vapiAssistant.model?.systemPrompt,
                        ...(vapiAssistant.model?.temperature !== undefined ? { temperature: vapiAssistant.model.temperature } : {}),
                    };
                }

                // Update voice config
                if (body.voice_id || body.voice_provider) {
                    updateData.voice = {
                        provider: body.voice_provider || vapiAssistant.voice?.provider || 'openai',
                        voiceId: body.voice_id || vapiAssistant.voice?.voiceId || '',
                        ...(vapiAssistant.voice?.speed !== undefined ? { speed: vapiAssistant.voice.speed } : {}),
                        ...(vapiAssistant.voice?.stability !== undefined ? { stability: vapiAssistant.voice.stability } : {}),
                    };
                }

                // Update transcriber language
                if (body.language) {
                    updateData.transcriber = {
                        provider: vapiAssistant.transcriber?.provider || 'deepgram',
                        model: vapiAssistant.transcriber?.model,
                        language: body.language,
                    };
                }

                if (body.first_message) updateData.firstMessage = body.first_message;

                if (Object.keys(updateData).length > 0) {
                    await updateVapiAssistant(apiKey, agent.external_id, updateData);
                }

                // Store in local config
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name || agent.config?.agent_name,
                    prompt: body.prompt || agent.config?.prompt,
                    voice_id: body.voice_id || agent.config?.voice_id,
                    language: body.language || agent.config?.language,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id);

            } catch (err) {
                console.error('Error updating Vapi assistant:', err);
                return NextResponse.json(
                    { error: 'Failed to update agent on provider' },
                    { status: 500 }
                );
            }
        } else if (agent.provider === 'bland') {
            try {
                const updateData: Partial<{ name: string; description: string }> = {};

                if (body.agent_name) updateData.name = body.agent_name;
                if (body.prompt) updateData.description = body.prompt;

                if (Object.keys(updateData).length > 0) {
                    await updateBlandPathway(apiKey, agent.external_id, updateData);
                }

                // Store in local config
                const newConfig = {
                    ...agent.config,
                    agent_name: body.agent_name || agent.config?.agent_name,
                    prompt: body.prompt || agent.config?.prompt,
                };

                await supabase
                    .from('agents')
                    .update({
                        config: newConfig,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id);

            } catch (err) {
                console.error('Error updating Bland pathway:', err);
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
        console.error('Error updating agent on provider:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
