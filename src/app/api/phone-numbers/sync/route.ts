import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { listVapiPhoneNumbers } from '@/lib/providers/vapi';
import { listBlandPhoneNumbers } from '@/lib/providers/bland';
import { decrypt } from '@/lib/crypto';
import { withErrorHandling } from '@/lib/api/response';

const PROVIDER_API_TIMEOUT = 15_000;

// POST /api/phone-numbers/sync - Sync phone numbers from Retell, VAPI, and Bland
export const POST = withErrorHandling(async (_request: NextRequest) => {
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

        // Decrypt API keys from DB
        if (agency) {
            agency.retell_api_key = decrypt(agency.retell_api_key) ?? agency.retell_api_key;
            agency.vapi_api_key = decrypt(agency.vapi_api_key) ?? agency.vapi_api_key;
            agency.bland_api_key = decrypt(agency.bland_api_key) ?? agency.bland_api_key;
        }

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
                    signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                });

                if (retellResponse.ok) {
                    const retellNumbers = await retellResponse.json();
                    console.info('Retell numbers fetched:', retellNumbers?.length || 0);
                    total += retellNumbers?.length || 0;

                    for (const retellNumber of retellNumbers) {
                        const inboundAgentId = retellNumber.inbound_agent_id
                            ? agentMap.get(retellNumber.inbound_agent_id)
                            : null;
                        const outboundAgentId = retellNumber.outbound_agent_id
                            ? agentMap.get(retellNumber.outbound_agent_id)
                            : null;

                        // Use phone_number_id from Retell as external_id (consistent with purchase route)
                        const externalId = retellNumber.phone_number_id || retellNumber.phone_number;

                        // Check by external_id first, then by phone_number (consistent with Vapi sync)
                        const { data: existingById } = await supabase
                            .from('phone_numbers')
                            .select('id')
                            .eq('external_id', externalId)
                            .eq('agency_id', user.agency.id)
                            .maybeSingle();

                        const existing = existingById || (await supabase
                            .from('phone_numbers')
                            .select('id')
                            .eq('phone_number', retellNumber.phone_number)
                            .eq('agency_id', user.agency.id)
                            .maybeSingle()).data;

                        if (existing) {
                            const { error: updateErr } = await supabase
                                .from('phone_numbers')
                                .update({
                                    phone_number: retellNumber.phone_number,
                                    external_id: externalId,
                                    inbound_agent_id: inboundAgentId,
                                    outbound_agent_id: outboundAgentId,
                                    agent_id: inboundAgentId,
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', existing.id);
                            if (!updateErr) updated++;
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
                                    monthly_cost_cents: 0,
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
                // Only count numbers that have an actual phone number (excludes virtual/SIP)
                const vapiWithNumber = vapiNumbers.filter(n => n.number);
                total += vapiWithNumber.length;

                for (const vapiNumber of vapiNumbers) {
                    // VAPI uses assistantId for inbound, no separate outbound
                    const inboundAgentId = vapiNumber.assistantId
                        ? agentMap.get(vapiNumber.assistantId)
                        : null;

                    // Vapi-managed virtual/SIP numbers don't have a phone number field —
                    // only Twilio/Vonage-backed numbers include "number". Skip virtual numbers.
                    const phoneNumber = vapiNumber.number;
                    if (!phoneNumber) continue;

                    // Check by external_id first (unique constraint), then by phone_number
                    const { data: existingById } = await supabase
                        .from('phone_numbers')
                        .select('id')
                        .eq('external_id', vapiNumber.id)
                        .eq('agency_id', user.agency.id)
                        .maybeSingle();

                    const existing = existingById || (await supabase
                        .from('phone_numbers')
                        .select('id')
                        .eq('phone_number', phoneNumber)
                        .eq('agency_id', user.agency.id)
                        .maybeSingle()).data;

                    if (existing) {
                        await supabase
                            .from('phone_numbers')
                            .update({
                                phone_number: phoneNumber,
                                external_id: vapiNumber.id,
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
                                monthly_cost_cents: 0,
                                purchased_at: new Date().toISOString(),
                            });
                        if (insertErr) {
                            console.error('Vapi phone insert error:', insertErr.code);
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
                console.info('Bland numbers fetched:', blandNumbers?.length || 0);
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
                        const { error: updateErr } = await supabase
                            .from('phone_numbers')
                            .update({
                                agent_id: inboundAgentId,
                                inbound_agent_id: inboundAgentId,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', existing.id);
                        if (!updateErr) updated++;
                    } else {
                        const { error: insertErr } = await supabase
                            .from('phone_numbers')
                            .insert({
                                agency_id: user.agency.id,
                                external_id: phoneNumber,
                                phone_number: phoneNumber,
                                provider: 'bland',
                                agent_id: inboundAgentId,
                                inbound_agent_id: inboundAgentId,
                                monthly_cost_cents: 0,
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
});
