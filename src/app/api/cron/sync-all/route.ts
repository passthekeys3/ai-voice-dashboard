import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAgencyProviders, type NormalizedAgent } from '@/lib/providers';

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

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // Get all agencies with API keys configured
        const { data: agencies, error: agenciesError } = await supabase
            .from('agencies')
            .select('id, name, retell_api_key, vapi_api_key')
            .or('retell_api_key.neq.null,vapi_api_key.neq.null');

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

                        // Sync Phone Numbers (Retell only)
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
