import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { updateRetellAgent, getRetellAgent, getRetellLLM, updateRetellLLM } from '@/lib/providers/retell';

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
            .select('external_id, provider, config')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Get agency API keys
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Fetch from Retell
        if (agent.provider === 'retell' && agency.retell_api_key) {
            try {
                const retellAgent = await getRetellAgent(agency.retell_api_key, agent.external_id);

                // Get LLM details if agent has a response_engine with llm_id
                let llmPrompt = '';
                let llmId = '';

                if (retellAgent.response_engine?.type === 'retell-llm' && retellAgent.response_engine.llm_id) {
                    llmId = retellAgent.response_engine.llm_id;
                    try {
                        const llm = await getRetellLLM(agency.retell_api_key, llmId);
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
                return NextResponse.json({ error: 'Failed to fetch from Retell' }, { status: 500 });
            }
        }

        return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
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
            .select('external_id, provider, config')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Get agency API keys
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key')
            .eq('id', user.agency.id)
            .single();

        if (agencyError || !agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Update on provider
        if (agent.provider === 'retell' && agency.retell_api_key) {
            try {
                // First, get the current agent to find LLM ID
                const retellAgent = await getRetellAgent(agency.retell_api_key, agent.external_id);

                // Update agent settings (name, voice, language, responsiveness)
                const updateData: Record<string, unknown> = {};
                if (body.agent_name) updateData.agent_name = body.agent_name;
                if (body.voice_id) updateData.voice_id = body.voice_id;
                if (body.language) updateData.language = body.language;
                if (body.responsiveness !== undefined) updateData.responsiveness = body.responsiveness;

                if (Object.keys(updateData).length > 0) {
                    await updateRetellAgent(
                        agency.retell_api_key,
                        agent.external_id,
                        updateData
                    );
                }

                // Update LLM prompt if provided
                if (body.prompt && retellAgent.response_engine?.llm_id) {
                    await updateRetellLLM(
                        agency.retell_api_key,
                        retellAgent.response_engine.llm_id,
                        { general_prompt: body.prompt }
                    );
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
        } else if (agent.provider === 'vapi' && agency.vapi_api_key) {
            return NextResponse.json({ error: 'Vapi updates not yet supported' }, { status: 501 });
        } else {
            return NextResponse.json({ error: 'No API key configured for this provider' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating agent on provider:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
