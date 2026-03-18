import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { getRetellAgent, updateRetellLLM } from '@/lib/providers/retell';
import { updateVapiAssistant, getVapiAssistant, usesVapiMessagesFormat } from '@/lib/providers/vapi';
import type { VapiAssistant } from '@/lib/providers/vapi';
import { updateBlandPathway } from '@/lib/providers/bland';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import type { VoiceProvider } from '@/types';
import { safeParseJson, isValidUuid } from '@/lib/validation';

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

        // ---- Tier gate: Experiments require Growth+ ----
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'experiments', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const body = bodyOrError as unknown as PromoteRequestBody;

        if (!body.variant_id || !isValidUuid(body.variant_id)) {
            return NextResponse.json({ error: 'Valid variant_id is required' }, { status: 400 });
        }

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

        // Guard: only allow promotion from running or paused experiments
        if (experiment.status !== 'running' && experiment.status !== 'paused') {
            return NextResponse.json(
                { error: experiment.status === 'completed'
                    ? 'This experiment has already been completed. Cannot promote again.'
                    : 'Experiment must be running or paused to promote a winner.' },
                { status: 400 }
            );
        }

        // Find the winning variant
        const winnerVariant = experiment.variants?.find(
            (v: { id: string }) => v.id === body.variant_id
        );

        if (!winnerVariant) {
            return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
        }

        // Control variant already uses the agent's current prompt — skip provider update
        if (winnerVariant.is_control) {
            // Just mark the experiment as completed with the control as winner
            await supabase
                .from('experiments')
                .update({
                    status: 'completed',
                    winner_variant_id: body.variant_id,
                    end_date: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('agency_id', user.agency.id);

            return NextResponse.json({
                success: true,
                message: `Control variant "${winnerVariant.name}" won — agent prompt unchanged`,
                variant: winnerVariant,
            });
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
            const vapiAssistant = await getVapiAssistant(apiKey, agent.external_id);
            const useMessages = usesVapiMessagesFormat(vapiAssistant.model);
            const modelUpdate: Record<string, unknown> = {
                provider: vapiAssistant.model?.provider || 'openai',
                model: vapiAssistant.model?.model || 'gpt-4o',
                ...(vapiAssistant.model?.temperature !== undefined ? { temperature: vapiAssistant.model.temperature } : {}),
            };
            if (useMessages) {
                const existingMessages = vapiAssistant.model?.messages || [];
                const hasSystemMsg = existingMessages.some(m => m.role === 'system');
                modelUpdate.messages = hasSystemMsg
                    ? existingMessages.map(m => m.role === 'system' ? { ...m, content: winnerVariant.prompt } : m)
                    : [{ role: 'system', content: winnerVariant.prompt }, ...existingMessages];
            } else {
                modelUpdate.systemPrompt = winnerVariant.prompt;
            }
            await updateVapiAssistant(apiKey, agent.external_id, { model: modelUpdate as VapiAssistant['model'] });
        } else if (agent.provider === 'bland') {
            await updateBlandPathway(apiKey, agent.external_id, {
                description: winnerVariant.prompt,
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
