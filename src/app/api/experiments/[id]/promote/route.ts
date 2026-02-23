import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getRetellAgent, updateRetellLLM } from '@/lib/providers/retell';
import { updateVapiAssistant } from '@/lib/providers/vapi';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import type { VoiceProvider } from '@/types';

interface PromoteRequestBody {
    variant_id: string;
}

export async function POST(
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
        const body: PromoteRequestBody = await request.json();
        const supabase = await createClient();

        // Get experiment with variants
        const { data: experiment, error: expError } = await supabase
            .from('experiments')
            .select(`
                *,
                variants:experiment_variants(*),
                agents(id, external_id, provider, config, client_id)
            `)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (expError || !experiment) {
            return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        }

        // Find the winning variant
        const winnerVariant = experiment.variants?.find(
            (v: { id: string }) => v.id === body.variant_id
        );

        if (!winnerVariant) {
            return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
        }

        const agent = experiment.agents;
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Resolve API keys with client-level override
        const resolvedKeys = await resolveProviderApiKeys(
            supabase,
            user.agency.id,
            agent.client_id
        );
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json(
                { error: `${agent.provider} API key not configured` },
                { status: 400 }
            );
        }

        // Update the agent's prompt based on provider
        if (agent.provider === 'retell') {
            // Get the agent to find its LLM ID
            const retellAgent = await getRetellAgent(apiKey, agent.external_id);

            // Check for LLM ID in different possible locations
            const llmId = retellAgent.llm_id ||
                         retellAgent.response_engine?.llm_id;

            if (!llmId) {
                return NextResponse.json(
                    { error: 'Agent does not have a Retell LLM configured' },
                    { status: 400 }
                );
            }

            // Update the LLM's prompt
            await updateRetellLLM(apiKey, llmId, {
                general_prompt: winnerVariant.prompt,
            });
        } else if (agent.provider === 'vapi') {
            // Update the assistant's model.systemPrompt via PATCH
            await updateVapiAssistant(apiKey, agent.external_id, {
                model: {
                    provider: 'openai',
                    model: 'gpt-4o',
                    systemPrompt: winnerVariant.prompt,
                },
            });
        }

        // Mark experiment as completed with winner
        const { error: updateError } = await supabase
            .from('experiments')
            .update({
                status: 'completed',
                winner_variant_id: body.variant_id,
                end_date: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (updateError) {
            console.error('Failed to update experiment status:', updateError.code);
            // Don't return error - the prompt was already updated
        }

        return NextResponse.json({
            success: true,
            message: `Successfully promoted "${winnerVariant.name}" and updated agent prompt`,
            variant: winnerVariant,
        });
    } catch (error) {
        console.error('Error promoting experiment winner:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
