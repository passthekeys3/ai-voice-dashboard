import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getAgencyProviders, type NormalizedAgent, type NormalizedCall } from '@/lib/providers';
import { listRetellAgents, ensureAgentWebhookConfig, REQUIRED_WEBHOOK_EVENTS } from '@/lib/providers/retell';

export async function POST() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createServiceClient();

        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        if (agencyError || !agency) {
            console.error('Agency fetch error:', agencyError);
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        const providers = getAgencyProviders(agency);

        if (providers.length === 0) {
            return NextResponse.json(
                { error: 'No API keys configured. Add Retell or Vapi API keys in settings.' },
                { status: 400 }
            );
        }

        const results = {
            agents: { synced: 0, errors: 0 },
            calls: { synced: 0, errors: 0, errorDetails: '' },
        };

        // Sync agents from each provider
        for (const { provider, client } of providers) {
            // Sync Agents
            try {
                const rawAgents: NormalizedAgent[] = await client.listAgents();

                // Deduplicate by external_id (keep first occurrence)
                const seenIds = new Set<string>();
                const externalAgents = rawAgents.filter(agent => {
                    if (seenIds.has(agent.externalId)) {
                        console.log(`[SYNC] Skipping duplicate agent: ${agent.name} (${agent.externalId})`);
                        return false;
                    }
                    seenIds.add(agent.externalId);
                    return true;
                });

                console.log(`Syncing ${externalAgents.length} unique agents from ${provider} (${rawAgents.length} raw)`);

                // Fetch all existing agents for this agency/provider in ONE query
                const { data: existingAgents, error: fetchError } = await supabase
                    .from('agents')
                    .select('id, external_id, name')
                    .eq('agency_id', user.agency.id)
                    .eq('provider', provider);

                if (fetchError) {
                    console.error('[SYNC] Error fetching existing agents:', fetchError);
                    results.agents.errors += externalAgents.length;
                    continue;
                }

                // Build a Map of external_id -> existing agent
                const existingMap = new Map(
                    existingAgents?.map(a => [a.external_id, a]) || []
                );

                console.log(`[SYNC] Found ${existingMap.size} existing agents for ${provider}`);

                // Prepare batch upsert data
                const toUpsert = externalAgents.map(extAgent => {
                    const existing = existingMap.get(extAgent.externalId);
                    if (existing) {
                        console.log(`[SYNC] Will update agent ${existing.id} from "${existing.name}" to "${extAgent.name}"`);
                    } else {
                        console.log(`[SYNC] Will insert new agent: ${extAgent.name}`);
                    }

                    return {
                        agency_id: user.agency.id,
                        name: extAgent.name,
                        provider,
                        external_id: extAgent.externalId,
                        config: extAgent.config,
                        updated_at: new Date().toISOString(),
                    };
                });

                // Single batch upsert call
                if (toUpsert.length > 0) {
                    const { error: upsertError, data: upsertedData } = await supabase
                        .from('agents')
                        .upsert(toUpsert, {
                            onConflict: 'agency_id,provider,external_id',
                            ignoreDuplicates: false,
                        })
                        .select('id');

                    if (upsertError) {
                        console.error('[SYNC] Batch upsert error:', upsertError);
                        results.agents.errors += toUpsert.length;
                    } else {
                        results.agents.synced += toUpsert.length;
                        console.log(`[SYNC] Successfully upserted ${upsertedData?.length || toUpsert.length} agents`);
                    }
                }

                // Ensure all Retell agents have webhook_events (including transcript_updated) configured.
                // update-agent only modifies the draft, so ensureAgentWebhookConfig also publishes
                // the agent to make changes effective on live phone calls.
                if (provider === 'retell' && agency.retell_api_key) {
                    try {
                        // Fetch fresh agent configs from Retell to check current webhook settings
                        const retellAgents = await listRetellAgents(agency.retell_api_key);
                        const retellMap = new Map(retellAgents.map(a => [a.agent_id, a]));

                        let patchedCount = 0;
                        for (const extAgent of externalAgents) {
                            const retellAgent = retellMap.get(extAgent.externalId);
                            if (!retellAgent) continue;
                            try {
                                const patched = await ensureAgentWebhookConfig(
                                    agency.retell_api_key,
                                    retellAgent
                                );
                                if (patched) patchedCount++;
                            } catch (err) {
                                console.error(`[SYNC] Failed to patch+publish agent ${extAgent.externalId}:`, err);
                            }
                        }
                        if (patchedCount > 0) {
                            console.log(`[SYNC] Patched & published webhook config on ${patchedCount} agents (events=${REQUIRED_WEBHOOK_EVENTS.join(',')})`);
                        }
                    } catch (err) {
                        console.error('[SYNC] Failed to ensure agent webhook configs:', err);
                    }
                }
            } catch (err) {
                console.error(`Error syncing agents from ${provider}:`, err);
            }

            // Sync Calls (separate try/catch so failures don't affect agent sync)
            try {
                const externalCalls: NormalizedCall[] = await client.listCalls({ limit: 100 });
                console.log(`[SYNC] Fetched ${externalCalls.length} calls from ${provider}`);

                // Fetch agent mapping in one query
                const { data: dbAgents } = await supabase
                    .from('agents')
                    .select('id, external_id, client_id')
                    .eq('agency_id', user.agency.id)
                    .eq('provider', provider);

                const agentMap = new Map(
                    dbAgents?.map(a => [a.external_id, { id: a.id, client_id: a.client_id }]) || []
                );

                console.log(`[SYNC] Agent map has ${agentMap.size} agents:`, Array.from(agentMap.keys()).slice(0, 3));

                // Filter calls that have matching agents
                const callsWithAgents: { call: NormalizedCall; agentInfo: { id: string; client_id: string | null } }[] = [];
                let unmatchedCalls = 0;

                for (const extCall of externalCalls) {
                    const agentInfo = agentMap.get(extCall.agentExternalId);
                    if (!agentInfo) {
                        if (unmatchedCalls < 3) {
                            console.log(`[SYNC] No match for call agent: "${extCall.agentExternalId}"`);
                        }
                        unmatchedCalls++;
                        continue;
                    }
                    callsWithAgents.push({ call: extCall, agentInfo });
                }

                console.log(`[SYNC] Call matching: ${callsWithAgents.length} matched, ${unmatchedCalls} unmatched`);

                if (callsWithAgents.length === 0) {
                    continue;
                }

                // Fetch all existing calls by external_id in ONE query
                const callExternalIds = callsWithAgents.map(c => c.call.externalId);
                const { data: existingCalls, error: callsFetchError } = await supabase
                    .from('calls')
                    .select('id, external_id')
                    .in('external_id', callExternalIds);

                if (callsFetchError) {
                    console.error('[SYNC] Error fetching existing calls:', callsFetchError);
                    results.calls.errors += callsWithAgents.length;
                    results.calls.errorDetails = `Fetch error: ${callsFetchError.message}`;
                    continue;
                }

                // Build a Map of external_id -> existing call
                const existingCallsMap = new Map(
                    existingCalls?.map(c => [c.external_id, c]) || []
                );

                console.log(`[SYNC] Found ${existingCallsMap.size} existing calls out of ${callsWithAgents.length}`);

                // Prepare batch upsert data for calls
                const callsToUpsert = callsWithAgents.map(({ call: extCall, agentInfo }) => ({
                    agent_id: agentInfo.id,
                    client_id: agentInfo.client_id,
                    external_id: extCall.externalId,
                    provider,
                    status: extCall.status,
                    direction: extCall.direction,
                    duration_seconds: extCall.durationSeconds,
                    cost_cents: extCall.costCents,
                    from_number: extCall.fromNumber,
                    to_number: extCall.toNumber,
                    transcript: extCall.transcript,
                    audio_url: extCall.audioUrl,
                    summary: extCall.summary,
                    sentiment: extCall.sentiment,
                    started_at: extCall.startedAt,
                    ended_at: extCall.endedAt,
                    metadata: extCall.metadata,
                }));

                // Single batch upsert call for calls
                if (callsToUpsert.length > 0) {
                    const { error: callUpsertError } = await supabase
                        .from('calls')
                        .upsert(callsToUpsert, {
                            onConflict: 'external_id',
                            ignoreDuplicates: false,
                        });

                    if (callUpsertError) {
                        console.error('[SYNC] Batch call upsert error:', callUpsertError);
                        results.calls.errors += callsToUpsert.length;
                        results.calls.errorDetails = `Upsert error: ${callUpsertError.message}`;
                    } else {
                        results.calls.synced += callsToUpsert.length;
                        console.log(`[SYNC] Successfully upserted ${callsToUpsert.length} calls`);
                    }
                }
            } catch (err) {
                console.error(`Error syncing calls from ${provider}:`, err);
            }
        }

        return NextResponse.json({
            message: 'Sync completed',
            results,
        });
    } catch (error) {
        console.error('Error during sync:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
