import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { listVapiPhoneNumbers } from '@/lib/providers/vapi';
import { listBlandPhoneNumbers } from '@/lib/providers/bland';

// POST /api/phone-numbers/sync - Sync phone numbers from Retell, VAPI, and Bland
export async function POST(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();

        // Get API keys for all providers
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key && !agency?.vapi_api_key && !agency?.bland_api_key) {
            return NextResponse.json({ error: 'No API keys configured' }, { status: 400 });
        }

        // Get our agents to map external IDs
        const { data: agents } = await supabase
            .from('agents')
            .select('id, external_id')
            .eq('agency_id', user.agency.id);

        const agentMap = new Map(
            agents?.map(a => [a.external_id, a.id]) || []
        );

        let synced = 0;
        let updated = 0;
        let total = 0;

        // Sync Retell phone numbers
        if (agency.retell_api_key) {
            try {
                const retellResponse = await fetch('https://api.retellai.com/list-phone-numbers', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${agency.retell_api_key}`,
                    },
                });

                if (retellResponse.ok) {
                    const retellNumbers = await retellResponse.json();
                    console.log('Retell numbers fetched:', retellNumbers?.length || 0);
                    total += retellNumbers?.length || 0;

                    for (const retellNumber of retellNumbers) {
                        const inboundAgentId = retellNumber.inbound_agent_id
                            ? agentMap.get(retellNumber.inbound_agent_id)
                            : null;
                        const outboundAgentId = retellNumber.outbound_agent_id
                            ? agentMap.get(retellNumber.outbound_agent_id)
                            : null;

                        const externalId = retellNumber.phone_number;

                        const { data: existing } = await supabase
                            .from('phone_numbers')
                            .select('id')
                            .eq('phone_number', externalId)
                            .eq('agency_id', user.agency.id)
                            .maybeSingle();

                        if (existing) {
                            await supabase
                                .from('phone_numbers')
                                .update({
                                    phone_number: retellNumber.phone_number,
                                    inbound_agent_id: inboundAgentId,
                                    outbound_agent_id: outboundAgentId,
                                    agent_id: inboundAgentId,
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', existing.id);
                            updated++;
                        } else {
                            const { error: insertErr } = await supabase
                                .from('phone_numbers')
                                .insert({
                                    agency_id: user.agency.id,
                                    external_id: externalId,
                                    phone_number: retellNumber.phone_number,
                                    provider: 'retell',
                                    inbound_agent_id: inboundAgentId,
                                    outbound_agent_id: outboundAgentId,
                                    agent_id: inboundAgentId,
                                    monthly_cost_cents: 200,
                                    purchased_at: new Date().toISOString(),
                                });
                            if (insertErr) {
                                console.error('Retell phone insert error:', insertErr.code);
                            } else {
                                synced++;
                            }
                        }
                    }
                } else {
                    console.error('Retell API error:', retellResponse.status);
                }
            } catch (error) {
                console.error('Error syncing Retell phone numbers:', error instanceof Error ? error.message : 'Unknown error');
            }
        }

        // Sync VAPI phone numbers
        if (agency.vapi_api_key) {
            try {
                const vapiNumbers = await listVapiPhoneNumbers(agency.vapi_api_key);
                console.log('VAPI numbers fetched:', vapiNumbers?.length || 0);
                total += vapiNumbers?.length || 0;

                for (const vapiNumber of vapiNumbers) {
                    // VAPI uses assistantId for inbound, no separate outbound
                    const inboundAgentId = vapiNumber.assistantId
                        ? agentMap.get(vapiNumber.assistantId)
                        : null;

                    // VAPI uses 'number' field, normalize to E.164
                    const phoneNumber = vapiNumber.number;

                    const { data: existing } = await supabase
                        .from('phone_numbers')
                        .select('id')
                        .eq('phone_number', phoneNumber)
                        .eq('agency_id', user.agency.id)
                        .maybeSingle();

                    if (existing) {
                        await supabase
                            .from('phone_numbers')
                            .update({
                                inbound_agent_id: inboundAgentId,
                                agent_id: inboundAgentId,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', existing.id);
                        updated++;
                    } else {
                        const { error: insertErr } = await supabase
                            .from('phone_numbers')
                            .insert({
                                agency_id: user.agency.id,
                                external_id: vapiNumber.id,
                                phone_number: phoneNumber,
                                provider: 'vapi',
                                inbound_agent_id: inboundAgentId,
                                agent_id: inboundAgentId,
                                monthly_cost_cents: 200,
                                purchased_at: new Date().toISOString(),
                            });
                        if (insertErr) {
                            console.error('Vapi phone insert error:', insertErr.code, 'for number:', phoneNumber);
                        } else {
                            synced++;
                        }
                    }
                }
            } catch (error) {
                console.error('Error syncing VAPI phone numbers:', error instanceof Error ? error.message : 'Unknown error');
            }
        }

        // Sync Bland phone numbers
        if (agency.bland_api_key) {
            try {
                const blandNumbers = await listBlandPhoneNumbers(agency.bland_api_key);
                console.log('Bland numbers fetched:', blandNumbers?.length || 0);
                total += blandNumbers?.length || 0;

                for (const blandNumber of blandNumbers) {
                    const inboundAgentId = blandNumber.pathway_id
                        ? agentMap.get(blandNumber.pathway_id)
                        : null;

                    const phoneNumber = blandNumber.phone_number;

                    const { data: existing } = await supabase
                        .from('phone_numbers')
                        .select('id')
                        .eq('phone_number', phoneNumber)
                        .eq('agency_id', user.agency.id)
                        .maybeSingle();

                    if (existing) {
                        await supabase
                            .from('phone_numbers')
                            .update({
                                agent_id: inboundAgentId,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', existing.id);
                        updated++;
                    } else {
                        const { error: insertErr } = await supabase
                            .from('phone_numbers')
                            .insert({
                                agency_id: user.agency.id,
                                external_id: phoneNumber,
                                phone_number: phoneNumber,
                                provider: 'bland',
                                agent_id: inboundAgentId,
                                monthly_cost_cents: 200,
                                purchased_at: new Date().toISOString(),
                            });
                        if (insertErr) {
                            console.error('Bland phone insert error:', insertErr.code);
                        } else {
                            synced++;
                        }
                    }
                }
            } catch (error) {
                console.error('Error syncing Bland phone numbers:', error instanceof Error ? error.message : 'Unknown error');
            }
        }

        return NextResponse.json({
            success: true,
            synced,
            updated,
            total,
        });
    } catch (error) {
        console.error('Error syncing phone numbers:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
