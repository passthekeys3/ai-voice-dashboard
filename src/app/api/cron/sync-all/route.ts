import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getAgencyProviders, type NormalizedAgent } from '@/lib/providers';
import { listRetellAgents, ensureAgentWebhookConfig, REQUIRED_WEBHOOK_EVENTS } from '@/lib/providers/retell';
import { listVapiAssistants, updateVapiAssistant } from '@/lib/providers/vapi';

/**
 * Cron endpoint to sync all agencies' agents and phone numbers
 *
 * This should be called by Vercel Cron or a similar scheduler
 * Protected by CRON_SECRET to prevent unauthorized access
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET not configured - rejecting cron request for security');
            return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
        }

        const expected = `Bearer ${cronSecret}`;
        if (!authHeader || authHeader.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // Get all agencies with API keys configured
        const { data: agencies, error: agenciesError } = await supabase
            .from('agencies')
            .select('id, name, retell_api_key, vapi_api_key, bland_api_key')
            .or('retell_api_key.neq.null,vapi_api_key.neq.null,bland_api_key.neq.null');

        if (agenciesError) {
            console.error('Error fetching agencies:', agenciesError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!agencies || agencies.length === 0) {
            return NextResponse.json({ message: 'No agencies to sync', synced: 0 });
        }

        console.log(`[CRON SYNC] Starting sync for ${agencies.length} agencies`);

        const results = {
            agencies_synced: 0,
            total_agents: 0,
            total_phone_numbers: 0,
            errors: [] as string[],
        };

        for (const agency of agencies) {
            try {
                const providers = getAgencyProviders(agency);

                if (providers.length === 0) continue;

                // Sync agents from each provider
                for (const { provider, client } of providers) {
                    try {
                        // Sync Agents
                        const externalAgents: NormalizedAgent[] = await client.listAgents();

                        // Prepare batch upsert data for agents
                        const agentsToUpsert = externalAgents.map(extAgent => ({
                            agency_id: agency.id,
                            name: extAgent.name,
                            provider,
                            external_id: extAgent.externalId,
                            config: extAgent.config,
                            updated_at: new Date().toISOString(),
                        }));

                        // Single batch upsert for all agents
                        if (agentsToUpsert.length > 0) {
                            const { error: agentUpsertError, data: upsertedAgents } = await supabase
                                .from('agents')
                                .upsert(agentsToUpsert, {
                                    onConflict: 'agency_id,provider,external_id',
                                    ignoreDuplicates: false,
                                })
                                .select('id');

                            if (!agentUpsertError) {
                                results.total_agents += upsertedAgents?.length || agentsToUpsert.length;
                                console.log(`[CRON SYNC] Agency ${agency.name}: upserted ${agentsToUpsert.length} agents from ${provider}`);
                            } else {
                                console.error(`[CRON SYNC] Agent upsert error for ${agency.name}:`, agentUpsertError);
                            }
                        }

                        // Ensure webhook_events (including transcript_updated) on all Retell agents
                        if (provider === 'retell' && agency.retell_api_key) {
                            try {
                                const retellAgents = await listRetellAgents(agency.retell_api_key);
                                const retellMap = new Map(retellAgents.map(a => [a.agent_id, a]));
                                let patchedCount = 0;
                                for (const extAgent of externalAgents) {
                                    const retellAgent = retellMap.get(extAgent.externalId);
                                    if (!retellAgent) continue;
                                    try {
                                        const patched = await ensureAgentWebhookConfig(agency.retell_api_key, retellAgent);
                                        if (patched) patchedCount++;
                                    } catch (err) {
                                        console.error(`[CRON SYNC] Failed to patch+publish agent ${extAgent.externalId}:`, err);
                                    }
                                }
                                if (patchedCount > 0) {
                                    console.log(`[CRON SYNC] Agency ${agency.name}: patched & published webhook config on ${patchedCount} agents (events=${REQUIRED_WEBHOOK_EVENTS.join(',')})`);
                                }
                            } catch (err) {
                                console.error(`[CRON SYNC] Failed to ensure webhook configs for agency ${agency.name}:`, err);
                            }
                        }

                        // Ensure serverUrl points to our webhook handler on all Vapi assistants
                        if (provider === 'vapi' && agency.vapi_api_key && process.env.NEXT_PUBLIC_APP_URL) {
                            try {
                                const expectedServerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/vapi`;
                                const vapiAssistants = await listVapiAssistants(agency.vapi_api_key);
                                const vapiExternalIds = new Set(
                                    externalAgents.map(a => a.externalId)
                                );
                                let patchedCount = 0;
                                for (const assistant of vapiAssistants) {
                                    // Only patch assistants that belong to this agency (synced above)
                                    if (!vapiExternalIds.has(assistant.id)) continue;
                                    if (assistant.serverUrl === expectedServerUrl) continue;
                                    try {
                                        await updateVapiAssistant(agency.vapi_api_key, assistant.id, {
                                            serverUrl: expectedServerUrl,
                                        });
                                        patchedCount++;
                                    } catch (err) {
                                        console.error(`[CRON SYNC] Failed to patch Vapi serverUrl for assistant ${assistant.id}:`, err);
                                    }
                                }
                                if (patchedCount > 0) {
                                    console.log(`[CRON SYNC] Agency ${agency.name}: patched serverUrl on ${patchedCount} Vapi assistants`);
                                }
                            } catch (err) {
                                console.error(`[CRON SYNC] Failed to ensure Vapi serverUrl for agency ${agency.name}:`, err);
                            }
                        }

                        // Sync Phone Numbers (Retell)
                        if (provider === 'retell' && agency.retell_api_key) {
                            try {
                                const phoneResponse = await fetch('https://api.retellai.com/list-phone-numbers', {
                                    method: 'GET',
                                    headers: {
                                        'Authorization': `Bearer ${agency.retell_api_key}`,
                                    },
                                });

                                if (phoneResponse.ok) {
                                    const phoneNumbers = await phoneResponse.json();

                                    if (phoneNumbers.length > 0) {
                                        // Fetch all agents for this agency in ONE query to build lookup map
                                        const { data: agencyAgents } = await supabase
                                            .from('agents')
                                            .select('id, external_id')
                                            .eq('agency_id', agency.id);

                                        const agentLookupMap = new Map(
                                            agencyAgents?.map(a => [a.external_id, a.id]) || []
                                        );

                                        // Prepare batch upsert data for phone numbers
                                        const phonesToUpsert = phoneNumbers.map((phone: {
                                            phone_number_id?: string;
                                            phone_number: string;
                                            nickname?: string;
                                            inbound_agent_id?: string;
                                        }) => ({
                                            agency_id: agency.id,
                                            external_id: phone.phone_number_id || phone.phone_number,
                                            phone_number: phone.phone_number,
                                            nickname: phone.nickname || null,
                                            provider: 'retell',
                                            status: 'active',
                                            agent_id: phone.inbound_agent_id
                                                ? agentLookupMap.get(phone.inbound_agent_id) || null
                                                : null,
                                            updated_at: new Date().toISOString(),
                                        }));

                                        // Single batch upsert for all phone numbers
                                        const { error: phoneUpsertError, data: upsertedPhones } = await supabase
                                            .from('phone_numbers')
                                            .upsert(phonesToUpsert, {
                                                onConflict: 'agency_id,external_id',
                                                ignoreDuplicates: false,
                                            })
                                            .select('id');

                                        if (!phoneUpsertError) {
                                            results.total_phone_numbers += upsertedPhones?.length || phonesToUpsert.length;
                                            console.log(`[CRON SYNC] Agency ${agency.name}: upserted ${phonesToUpsert.length} phone numbers`);
                                        } else {
                                            console.error(`[CRON SYNC] Phone upsert error for ${agency.name}:`, phoneUpsertError);
                                        }
                                    }
                                }
                            } catch (phoneErr) {
                                console.error(`Phone sync error for agency ${agency.id}:`, phoneErr);
                            }
                        }

                        // Sync Phone Numbers (Vapi)
                        if (provider === 'vapi' && agency.vapi_api_key) {
                            try {
                                const { listVapiPhoneNumbers } = await import('@/lib/providers/vapi');
                                const vapiNumbers = await listVapiPhoneNumbers(agency.vapi_api_key);

                                if (vapiNumbers.length > 0) {
                                    const { data: agencyAgents } = await supabase
                                        .from('agents')
                                        .select('id, external_id')
                                        .eq('agency_id', agency.id);

                                    const agentLookupMap = new Map(
                                        agencyAgents?.map(a => [a.external_id, a.id]) || []
                                    );

                                    const phonesToUpsert = vapiNumbers.map((phone) => ({
                                        agency_id: agency.id,
                                        external_id: phone.id,
                                        phone_number: phone.number,
                                        provider: 'vapi',
                                        status: 'active',
                                        agent_id: phone.assistantId
                                            ? agentLookupMap.get(phone.assistantId) || null
                                            : null,
                                        updated_at: new Date().toISOString(),
                                    }));

                                    const { error: phoneUpsertError, data: upsertedPhones } = await supabase
                                        .from('phone_numbers')
                                        .upsert(phonesToUpsert, {
                                            onConflict: 'agency_id,external_id',
                                            ignoreDuplicates: false,
                                        })
                                        .select('id');

                                    if (!phoneUpsertError) {
                                        results.total_phone_numbers += upsertedPhones?.length || phonesToUpsert.length;
                                        console.log(`[CRON SYNC] Agency ${agency.name}: upserted ${phonesToUpsert.length} Vapi phone numbers`);
                                    } else {
                                        console.error(`[CRON SYNC] Vapi phone upsert error for ${agency.name}:`, phoneUpsertError);
                                    }
                                }
                            } catch (phoneErr) {
                                console.error(`Vapi phone sync error for agency ${agency.id}:`, phoneErr);
                            }
                        }

                        // Sync Phone Numbers (Bland)
                        if (provider === 'bland' && agency.bland_api_key) {
                            try {
                                const { listBlandPhoneNumbers } = await import('@/lib/providers/bland');
                                const blandNumbers = await listBlandPhoneNumbers(agency.bland_api_key);

                                if (blandNumbers.length > 0) {
                                    const { data: agencyAgents } = await supabase
                                        .from('agents')
                                        .select('id, external_id')
                                        .eq('agency_id', agency.id);

                                    const agentLookupMap = new Map(
                                        agencyAgents?.map(a => [a.external_id, a.id]) || []
                                    );

                                    const phonesToUpsert = blandNumbers.map((phone) => ({
                                        agency_id: agency.id,
                                        external_id: phone.phone_number,
                                        phone_number: phone.phone_number,
                                        provider: 'bland',
                                        status: 'active',
                                        agent_id: phone.pathway_id
                                            ? agentLookupMap.get(phone.pathway_id) || null
                                            : null,
                                        updated_at: new Date().toISOString(),
                                    }));

                                    const { error: phoneUpsertError, data: upsertedPhones } = await supabase
                                        .from('phone_numbers')
                                        .upsert(phonesToUpsert, {
                                            onConflict: 'agency_id,external_id',
                                            ignoreDuplicates: false,
                                        })
                                        .select('id');

                                    if (!phoneUpsertError) {
                                        results.total_phone_numbers += upsertedPhones?.length || phonesToUpsert.length;
                                        console.log(`[CRON SYNC] Agency ${agency.name}: upserted ${phonesToUpsert.length} Bland phone numbers`);
                                    } else {
                                        console.error(`[CRON SYNC] Bland phone upsert error for ${agency.name}:`, phoneUpsertError);
                                    }
                                }
                            } catch (phoneErr) {
                                console.error(`Bland phone sync error for agency ${agency.id}:`, phoneErr);
                            }
                        }
                    } catch (providerErr) {
                        console.error(`Provider ${provider} sync error:`, providerErr);
                        results.errors.push(`${agency.name}: ${provider} sync failed`);
                    }
                }

                results.agencies_synced++;
            } catch (agencyErr) {
                console.error(`Agency ${agency.id} sync error:`, agencyErr);
                results.errors.push(`Agency ${agency.name} sync failed`);
            }
        }

        // Update last sync timestamp for all agencies
        await supabase
            .from('agencies')
            .update({ updated_at: new Date().toISOString() })
            .in('id', agencies.map(a => a.id));

        console.log(`[CRON SYNC] Complete:`, results);

        return NextResponse.json({
            message: 'Sync completed',
            ...results,
        });
    } catch (error) {
        console.error('[CRON SYNC] Fatal error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
