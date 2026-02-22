import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { publishRetellAgent } from '@/lib/providers/retell';

// POST /api/agents/create - Create a new agent in Retell
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const {
            name,
            voice_id,
            system_prompt,
            first_message,
            client_id,
            phone_number_id,
        } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
        }

        if (!voice_id) {
            return NextResponse.json({ error: 'Voice is required' }, { status: 400 });
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

        // Get Retell API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Step 1: Create a Retell LLM with the prompt and first message
        const llmResponse = await fetch('https://api.retellai.com/create-retell-llm', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                general_prompt: system_prompt || undefined,
                begin_message: first_message || null,
                model: 'gpt-4o',
                start_speaker: 'agent',
            }),
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
                'Authorization': `Bearer ${agency.retell_api_key}`,
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
                webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`}/api/webhooks/retell`,
                webhook_events: ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated'],
            }),
        });

        if (!retellResponse.ok) {
            console.error('Retell create agent error:', retellResponse.status);
            return NextResponse.json({
                error: 'Failed to create agent on provider'
            }, { status: 500 });
        }

        const retellAgent = await retellResponse.json();
        console.log('Retell agent created:', retellAgent.agent_id);

        // Publish the agent so webhook config takes effect on live calls
        // (create-agent creates a draft; publish makes it the active version)
        try {
            await publishRetellAgent(agency.retell_api_key, retellAgent.agent_id);
        } catch (pubErr) {
            console.error('Failed to publish agent after creation:', pubErr instanceof Error ? pubErr.message : 'Unknown error');
            // Non-fatal: agent exists but webhook config is only on draft
        }

        // Store in our database
        const { data: agent, error: dbError } = await supabase
            .from('agents')
            .insert({
                agency_id: user.agency.id,
                client_id: client_id || null,
                name: name.trim(),
                external_id: retellAgent.agent_id,
                provider: 'retell',
                is_active: true,
                config: {
                    voice_id,
                    system_prompt,
                    first_message,
                },
            })
            .select()
            .single();

        if (dbError) {
            console.error('Error saving agent to DB:', dbError.code);
            return NextResponse.json({ error: 'Failed to save agent' }, { status: 500 });
        }

        // If phone number specified, assign it (with race condition protection)
        if (phone_number_id) {
            // Only select phone number if it's unassigned (agent_id is null)
            const { data: phoneNumber } = await supabase
                .from('phone_numbers')
                .select('external_id, agent_id')
                .eq('id', phone_number_id)
                .eq('agency_id', user.agency.id)
                .is('agent_id', null)  // Only if currently unassigned
                .single();

            if (!phoneNumber) {
                console.warn(`Phone number ${phone_number_id} not found or already assigned`);
                // Don't fail the agent creation, just skip phone assignment
            } else if (phoneNumber.external_id) {
                // Update phone number in Retell
                const phoneUpdateResponse = await fetch(`https://api.retellai.com/update-phone-number/${encodeURIComponent(phoneNumber.external_id)}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${agency.retell_api_key}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inbound_agent_id: retellAgent.agent_id,
                    }),
                });

                if (!phoneUpdateResponse.ok) {
                    console.warn('Failed to update phone number in Retell:', phoneUpdateResponse.status);
                }

                // Update in our DB with optimistic lock + agency scoping
                const { error: updateError } = await supabase
                    .from('phone_numbers')
                    .update({ agent_id: agent.id, updated_at: new Date().toISOString() })
                    .eq('id', phone_number_id)
                    .eq('agency_id', user.agency.id)
                    .is('agent_id', null);  // Only update if still unassigned

                if (updateError) {
                    console.warn(`Failed to assign phone number: ${updateError.message}`);
                }
            }
        }

        return NextResponse.json({ data: agent }, { status: 201 });
    } catch (error) {
        console.error('Error creating agent:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
