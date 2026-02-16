import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getTemplateById, getTemplateActions } from '@/lib/agent-builder/templates';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_PROMPT_LENGTH = 50000;
const MAX_FIRST_MESSAGE_LENGTH = 1000;
const MAX_VOICE_ID_LENGTH = 200;

// POST /api/agent-builder/apply - Create agent + optional workflows
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { draft, client_id, phone_number_id } = body;

        // Validate required draft fields with length limits
        if (!draft?.name || typeof draft.name !== 'string' || !draft.name.trim()) {
            return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
        }
        if (draft.name.length > MAX_NAME_LENGTH) {
            return NextResponse.json({ error: `Agent name must be under ${MAX_NAME_LENGTH} characters` }, { status: 400 });
        }
        if (!draft?.voiceId || typeof draft.voiceId !== 'string') {
            return NextResponse.json({ error: 'Voice selection is required' }, { status: 400 });
        }
        if (draft.voiceId.length > MAX_VOICE_ID_LENGTH) {
            return NextResponse.json({ error: 'Invalid voice ID' }, { status: 400 });
        }
        if (!draft?.systemPrompt || typeof draft.systemPrompt !== 'string' || !draft.systemPrompt.trim()) {
            return NextResponse.json({ error: 'System prompt is required' }, { status: 400 });
        }
        if (draft.systemPrompt.length > MAX_PROMPT_LENGTH) {
            return NextResponse.json({ error: `System prompt must be under ${MAX_PROMPT_LENGTH} characters` }, { status: 400 });
        }

        // Validate optional string fields
        const safeName = draft.name.trim().slice(0, MAX_NAME_LENGTH);
        const safeSystemPrompt = draft.systemPrompt.trim().slice(0, MAX_PROMPT_LENGTH);
        const safeFirstMessage = typeof draft.firstMessage === 'string'
            ? draft.firstMessage.slice(0, MAX_FIRST_MESSAGE_LENGTH)
            : '';
        const safeVoiceName = typeof draft.voiceName === 'string'
            ? draft.voiceName.slice(0, MAX_NAME_LENGTH)
            : undefined;
        // BCP 47 language tag: "en", "en-US", "es", "fr-CA", etc.
        const safeLanguage = typeof draft.language === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(draft.language)
            ? draft.language
            : 'en';

        // Validate UUID format for IDs
        if (client_id && (typeof client_id !== 'string' || !UUID_REGEX.test(client_id))) {
            return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 });
        }
        if (phone_number_id && (typeof phone_number_id !== 'string' || !UUID_REGEX.test(phone_number_id))) {
            return NextResponse.json({ error: 'Invalid phone number ID format' }, { status: 400 });
        }

        const supabase = await createClient();

        // Validate client_id belongs to this agency
        if (client_id) {
            const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('id', client_id)
                .eq('agency_id', user.agency.id)
                .single();

            if (!client) {
                return NextResponse.json({ error: 'Client not found' }, { status: 404 });
            }
        }

        // Get provider API keys
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        // Use the provider from draft if specified and valid, otherwise auto-select
        const requestedProvider = draft.provider as string | undefined;
        const providerApiKeys: Record<string, string | null> = {
            retell: agency?.retell_api_key || null,
            vapi: agency?.vapi_api_key || null,
            bland: agency?.bland_api_key || null,
        };

        let provider: string | null = null;
        let apiKey: string | null = null;

        if (requestedProvider && ['retell', 'vapi', 'bland'].includes(requestedProvider) && providerApiKeys[requestedProvider]) {
            // User explicitly chose a provider and it has a valid API key
            provider = requestedProvider;
            apiKey = providerApiKeys[requestedProvider];
        } else {
            // Auto-select: Retell → Vapi → Bland
            provider = agency?.retell_api_key ? 'retell' : agency?.vapi_api_key ? 'vapi' : agency?.bland_api_key ? 'bland' : null;
            apiKey = agency?.retell_api_key || agency?.vapi_api_key || agency?.bland_api_key || null;
        }

        if (!provider || !apiKey) {
            return NextResponse.json(
                { error: 'No voice provider API key configured. Add a Retell, Vapi, or Bland key in Settings.' },
                { status: 400 }
            );
        }

        // Create agent on provider
        let externalId: string;

        if (provider === 'retell') {
            // Step 1: Create a Retell LLM with the prompt and first message
            const llmResponse = await fetch('https://api.retellai.com/create-retell-llm', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    general_prompt: safeSystemPrompt,
                    begin_message: safeFirstMessage || null,
                    model: 'gpt-4o-mini',
                    start_speaker: 'agent',
                }),
            });

            if (!llmResponse.ok) {
                console.error('Retell create LLM error:', llmResponse.status, await llmResponse.text());
                return NextResponse.json(
                    { error: 'Failed to create agent on voice provider' },
                    { status: 500 }
                );
            }

            const retellLlm = await llmResponse.json();

            // Step 2: Create the agent with the LLM ID
            const retellResponse = await fetch('https://api.retellai.com/create-agent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agent_name: safeName,
                    voice_id: draft.voiceId,
                    response_engine: {
                        type: 'retell-llm',
                        llm_id: retellLlm.llm_id,
                    },
                    enable_backchannel: true,
                    language: safeLanguage === 'en' ? 'en-US' : safeLanguage,
                    webhook_events: ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated'],
                }),
            });

            if (!retellResponse.ok) {
                console.error('Retell create agent error:', retellResponse.status, await retellResponse.text());
                return NextResponse.json(
                    { error: 'Failed to create agent on voice provider' },
                    { status: 500 }
                );
            }

            const retellAgent = await retellResponse.json();
            externalId = retellAgent.agent_id;
        } else if (provider === 'vapi') {
            // Vapi agent creation
            const vapiResponse = await fetch('https://api.vapi.ai/assistant', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: safeName,
                    voice: { voiceId: draft.voiceId },
                    firstMessage: safeFirstMessage || undefined,
                    model: {
                        provider: 'openai',
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: safeSystemPrompt,
                            },
                        ],
                    },
                }),
            });

            if (!vapiResponse.ok) {
                console.error('Vapi create agent error:', vapiResponse.status, await vapiResponse.text());
                return NextResponse.json(
                    { error: 'Failed to create agent on voice provider' },
                    { status: 500 }
                );
            }

            const vapiAgent = await vapiResponse.json();
            externalId = vapiAgent.id;
        } else {
            // Bland pathway creation
            // Bland uses Pathways (visual flowcharts) as the agent concept.
            // Programmatic creation creates a minimal pathway — users can refine it in the Bland dashboard.
            const blandResponse = await fetch('https://api.bland.ai/v1/pathway/create', {
                method: 'POST',
                headers: {
                    'authorization': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: safeName,
                    description: safeSystemPrompt,
                }),
            });

            if (!blandResponse.ok) {
                console.error('Bland create pathway error:', blandResponse.status, await blandResponse.text());
                return NextResponse.json(
                    { error: 'Failed to create agent on voice provider' },
                    { status: 500 }
                );
            }

            const blandPathway = await blandResponse.json();
            externalId = blandPathway.pathway_id;
        }

        // Store in database
        const { data: agent, error: dbError } = await supabase
            .from('agents')
            .insert({
                agency_id: user.agency.id,
                client_id: client_id || null,
                name: safeName,
                external_id: externalId,
                provider,
                is_active: true,
                config: {
                    voice_id: draft.voiceId,
                    voice_name: safeVoiceName,
                    system_prompt: safeSystemPrompt,
                    first_message: safeFirstMessage || undefined,
                    language: safeLanguage,
                },
            })
            .select()
            .single();

        if (dbError) {
            console.error('Error saving agent to DB:', safeName, dbError);
            return NextResponse.json({ error: 'Failed to save agent' }, { status: 500 });
        }

        // Assign phone number if specified (with race condition protection)
        if (phone_number_id) {
            const { data: phoneNumber } = await supabase
                .from('phone_numbers')
                .select('external_id, agent_id')
                .eq('id', phone_number_id)
                .eq('agency_id', user.agency.id)
                .is('agent_id', null)
                .single();

            if (phoneNumber?.external_id) {
                if (provider === 'retell') {
                    await fetch(`https://api.retellai.com/update-phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            inbound_agent_id: externalId,
                        }),
                    });
                } else if (provider === 'vapi') {
                    await fetch(`https://api.vapi.ai/phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            assistantId: externalId,
                        }),
                    });
                }
                // Note: Bland phone assignment is done at call time via pathway_id, not per-number

                await supabase
                    .from('phone_numbers')
                    .update({ agent_id: agent.id, updated_at: new Date().toISOString() })
                    .eq('id', phone_number_id)
                    .is('agent_id', null);
            }
        }

        // Create workflows for enabled integrations
        const workflowsCreated: string[] = [];
        const enabledIntegrations = Array.isArray(draft.integrations)
            ? draft.integrations.filter(
                (i: { enabled?: boolean; crm?: string; templateId?: string }) =>
                    i.enabled &&
                    typeof i.templateId === 'string' &&
                    (i.crm === 'ghl' || i.crm === 'hubspot') // CRM allowlist
            )
            : [];

        for (const integration of enabledIntegrations) {
            const template = getTemplateById(integration.templateId);
            if (!template) continue;

            const actions = getTemplateActions(template, integration.crm as 'ghl' | 'hubspot');
            if (actions.length === 0) continue;

            const { data: workflow, error: workflowError } = await supabase
                .from('workflows')
                .insert({
                    agency_id: user.agency.id,
                    agent_id: agent.id,
                    name: `${safeName} - ${template.name}`,
                    description: template.description,
                    trigger: template.trigger,
                    conditions: template.conditions,
                    actions,
                    is_active: true,
                })
                .select('id')
                .single();

            if (workflowError) {
                console.error(`Error creating workflow ${template.id}:`, workflowError);
            } else if (workflow) {
                workflowsCreated.push(workflow.id);
            }
        }

        return NextResponse.json({
            data: {
                agent_id: agent.id,
                external_id: externalId,
                provider,
                workflows_created: workflowsCreated.length,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Error in agent-builder apply:', error instanceof Error ? error.message : error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
