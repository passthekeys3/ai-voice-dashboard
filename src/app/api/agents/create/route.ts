import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { publishRetellAgent } from '@/lib/providers/retell';
import { createVapiAssistant } from '@/lib/providers/vapi';
import { createBlandPathway } from '@/lib/providers/bland';
import { safeParseJson } from '@/lib/validation';

const PROVIDER_API_TIMEOUT = 15_000;

// POST /api/agents/create - Create a new agent on the selected provider
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;
        const {
            name,
            provider: requestedProvider,
            voice_id,
            system_prompt,
            first_message,
            client_id,
            phone_number_id,
        } = bodyOrError;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
        }

        if (name.length > 200) {
            return NextResponse.json({ error: 'Agent name is too long (max 200 characters)' }, { status: 400 });
        }

        // Validate provider if explicitly requested
        const VALID_PROVIDERS = ['retell', 'vapi', 'bland'];
        if (requestedProvider && !VALID_PROVIDERS.includes(requestedProvider)) {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
        }

        if (system_prompt && system_prompt.length > 50000) {
            return NextResponse.json({ error: 'System prompt is too long' }, { status: 400 });
        }

        const supabase = await createClient();

        // Validate client_id belongs to this agency if provided
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

        // Get API keys for all providers
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        // Decrypt API keys (stored encrypted in DB)
        const retellKey = agency?.retell_api_key ? (decrypt(agency.retell_api_key) ?? undefined) : undefined;
        const vapiKey = agency?.vapi_api_key ? (decrypt(agency.vapi_api_key) ?? undefined) : undefined;
        const blandKey = agency?.bland_api_key ? (decrypt(agency.bland_api_key) ?? undefined) : undefined;

        // Determine which provider to use (requested > auto-select: retell → vapi → bland)
        const provider = requestedProvider || (
            retellKey ? 'retell'
            : vapiKey ? 'vapi'
            : blandKey ? 'bland'
            : null
        );

        const apiKeyMap: Record<string, string | undefined> = {
            retell: retellKey,
            vapi: vapiKey,
            bland: blandKey,
        };

        const apiKey = apiKeyMap[provider as string];

        if (!provider || !apiKey) {
            return NextResponse.json({
                error: 'No voice provider API key configured. Add a Retell, Vapi, or Bland key in Settings.'
            }, { status: 400 });
        }

        // Voice is required for Retell
        if (provider === 'retell' && !voice_id) {
            return NextResponse.json({ error: 'Voice is required for Retell agents' }, { status: 400 });
        }

        // Validate voice ID format if provided
        if (voice_id && (typeof voice_id !== 'string' || voice_id.length > 200 || !/^[a-zA-Z0-9_\-.:]+$/.test(voice_id))) {
            return NextResponse.json({ error: 'Invalid voice ID format' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;
        let externalId: string;
        const agentConfig: Record<string, unknown> = {};

        if (provider === 'retell') {
            // Step 1: Create a Retell LLM with the prompt and first message
            const llmResponse = await fetch('https://api.retellai.com/create-retell-llm', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    general_prompt: system_prompt || undefined,
                    begin_message: first_message || null,
                    model: 'gpt-4o',
                    start_speaker: 'agent',
                }),
                signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
            });

            if (!llmResponse.ok) {
                console.error('Retell create LLM error:', llmResponse.status);
                return NextResponse.json({
                    error: 'Failed to create agent on provider'
                }, { status: 500 });
            }

            const retellLlm = await llmResponse.json();

            // Step 2: Create the agent with the LLM ID and voice
            const retellResponse = await fetch('https://api.retellai.com/create-agent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agent_name: name.trim(),
                    voice_id,
                    response_engine: {
                        type: 'retell-llm',
                        llm_id: retellLlm.llm_id,
                    },
                    enable_backchannel: true,
                    webhook_url: `${appUrl}/api/webhooks/retell`,
                    webhook_events: ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated'],
                }),
                signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
            });

            if (!retellResponse.ok) {
                console.error('Retell create agent error:', retellResponse.status);
                // Clean up the orphaned LLM
                try {
                    await fetch(`https://api.retellai.com/delete-retell-llm/${retellLlm.llm_id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });
                } catch (cleanupErr) {
                    console.error('Failed to clean up orphaned LLM:', cleanupErr instanceof Error ? cleanupErr.message : 'Unknown error');
                }
                return NextResponse.json({
                    error: 'Failed to create agent on provider'
                }, { status: 500 });
            }

            const retellAgent = await retellResponse.json();
            externalId = retellAgent.agent_id;

            // Publish the agent so webhook config takes effect on live calls
            try {
                await publishRetellAgent(apiKey, externalId);
            } catch (pubErr) {
                console.error('Failed to publish agent after creation:', pubErr instanceof Error ? pubErr.message : 'Unknown error');
            }

            agentConfig.voice_id = voice_id;
            agentConfig.system_prompt = system_prompt;
            agentConfig.first_message = first_message;

        } else if (provider === 'vapi') {
            // Create a Vapi assistant
            try {
                const vapiConfig: Parameters<typeof createVapiAssistant>[1] = {
                    name: name.trim(),
                    model: {
                        provider: 'openai',
                        model: 'gpt-4o',
                        systemPrompt: system_prompt || undefined,
                    },
                    firstMessage: first_message || undefined,
                    serverUrl: `${appUrl}/api/webhooks/vapi`,
                };
                // Include voice if provided (ElevenLabs default)
                if (voice_id) {
                    vapiConfig.voice = { provider: '11labs', voiceId: voice_id };
                }
                const vapiAssistant = await createVapiAssistant(apiKey, vapiConfig);

                externalId = vapiAssistant.id;
            } catch (err) {
                console.error('Vapi create assistant error:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json({
                    error: 'Failed to create agent on provider'
                }, { status: 500 });
            }

            agentConfig.system_prompt = system_prompt;
            agentConfig.first_message = first_message;
            if (voice_id) {
                agentConfig.voice_id = voice_id;
                agentConfig.voice_provider = '11labs';
            }

        } else if (provider === 'bland') {
            // Create a Bland pathway
            try {
                const blandPathway = await createBlandPathway(apiKey, {
                    name: name.trim(),
                    description: system_prompt || undefined,
                });

                externalId = blandPathway.id;
            } catch (err) {
                console.error('Bland create pathway error:', err instanceof Error ? err.message : 'Unknown error');
                return NextResponse.json({
                    error: 'Failed to create agent on provider'
                }, { status: 500 });
            }

            agentConfig.system_prompt = system_prompt;
            if (voice_id) agentConfig.voice_id = voice_id;

        } else {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
        }

        // Store in our database
        const { data: agent, error: dbError } = await supabase
            .from('agents')
            .insert({
                agency_id: user.agency.id,
                client_id: client_id || null,
                name: name.trim(),
                external_id: externalId,
                provider,
                is_active: true,
                config: agentConfig,
            })
            .select()
            .single();

        if (dbError) {
            console.error('Error saving agent to DB:', dbError.code);
            return NextResponse.json({ error: 'Failed to save agent' }, { status: 500 });
        }

        // If phone number specified, assign it (with race condition protection)
        if (phone_number_id) {
            const { data: phoneNumber } = await supabase
                .from('phone_numbers')
                .select('external_id, agent_id, provider')
                .eq('id', phone_number_id)
                .eq('agency_id', user.agency.id)
                .is('agent_id', null)
                .single();

            if (!phoneNumber) {
                console.warn(`Phone number ${phone_number_id} not found or already assigned`);
            } else if (phoneNumber.external_id) {
                // Update phone number on the provider
                if (provider === 'retell') {
                    const phoneUpdateResponse = await fetch(`https://api.retellai.com/update-phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            inbound_agent_id: externalId,
                        }),
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });

                    if (!phoneUpdateResponse.ok) {
                        console.warn('Failed to update phone number in Retell:', phoneUpdateResponse.status);
                    }
                } else if (provider === 'vapi') {
                    const vapiPhoneRes = await fetch(`https://api.vapi.ai/phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ assistantId: externalId }),
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });

                    if (!vapiPhoneRes.ok) {
                        console.warn('Failed to update phone number in Vapi:', vapiPhoneRes.status);
                    }
                } else if (provider === 'bland') {
                    const blandPhoneRes = await fetch(`https://api.bland.ai/v1/inbound/${encodeURIComponent(phoneNumber.external_id)}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': apiKey,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ pathway_id: externalId }),
                        signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                    });

                    if (!blandPhoneRes.ok) {
                        console.warn('Failed to update phone number in Bland:', blandPhoneRes.status);
                    }
                }

                // Update in our DB with optimistic lock + agency scoping
                const { error: updateError } = await supabase
                    .from('phone_numbers')
                    .update({ agent_id: agent.id, inbound_agent_id: agent.id, updated_at: new Date().toISOString() })
                    .eq('id', phone_number_id)
                    .eq('agency_id', user.agency.id)
                    .is('agent_id', null);

                if (updateError) {
                    console.warn('Failed to assign phone number:', updateError.code);
                }
            }
        }

        return NextResponse.json({ data: agent }, { status: 201 });
    } catch (error) {
        console.error('Error creating agent:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
