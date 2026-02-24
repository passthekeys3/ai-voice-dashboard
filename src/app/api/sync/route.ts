import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getProviderClient, type NormalizedAgent, type NormalizedCall } from '@/lib/providers';
import { listRetellAgents, ensureAgentWebhookConfig, REQUIRED_WEBHOOK_EVENTS } from '@/lib/providers/retell';
import type { VoiceProvider } from '@/types';

/** One workspace to sync: a provider + API key + optional client scope */
interface SyncEntry {
    provider: VoiceProvider;
    apiKey: string;
    clientId: string | null;
    label: string;
}

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
            console.error('Agency fetch error:', agencyError?.code);
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Build a unified list of provider workspaces to sync.
        // Agency-level keys first, then client-level keys (skip duplicates).
        const syncEntries: SyncEntry[] = [];
        const seenApiKeys = new Set<string>();

        const keyFields: { field: 'retell_api_key' | 'vapi_api_key' | 'bland_api_key'; provider: VoiceProvider }[] = [
            { field: 'retell_api_key', provider: 'retell' },
            { field: 'vapi_api_key', provider: 'vapi' },
            { field: 'bland_api_key', provider: 'bland' },
        ];

        // Agency-level keys
        for (const { field, provider } of keyFields) {
            const key = agency[field];
            if (key) {
                syncEntries.push({ provider, apiKey: key, clientId: null, label: 'agency' });
                seenApiKeys.add(key);
            }
        }

        // Client-level keys (different workspaces only)
        const { data: clientsWithKeys } = await supabase
            .from('clients')
            .select('id, name, retell_api_key, vapi_api_key, bland_api_key')
            .eq('agency_id', user.agency.id)
            .or('retell_api_key.neq.null,vapi_api_key.neq.null,bland_api_key.neq.null');

        for (const clientRecord of clientsWithKeys || []) {
            for (const { field, provider } of keyFields) {
                const key = clientRecord[field];
                if (key && !seenApiKeys.has(key)) {
                    syncEntries.push({ provider, apiKey: key, clientId: clientRecord.id, label: clientRecord.name });
                    seenApiKeys.add(key);
                }
            }
        }

        if (syncEntries.length === 0) {
            return NextResponse.json(
                { error: 'No API keys configured. Add API keys in settings or on a client.' },
                { status: 400 }
            );
        }

        const results = {
            agents: { synced: 0, errors: 0 },
            calls: { synced: 0, errors: 0, errorDetails: '' },
        };

        // Sync agents & calls from each workspace
        for (const entry of syncEntries) {
            const { provider, apiKey, clientId, label } = entry;
            const providerClient = getProviderClient(provider, apiKey);

            // ─── Sync Agents ───
            try {
                const rawAgents: NormalizedAgent[] = await providerClient.listAgents();

                // Deduplicate by external_id (keep first occurrence)
                const dedupIds = new Set<string>();
                const externalAgents = rawAgents.filter(agent => {
                    if (dedupIds.has(agent.externalId)) {
                        console.log(`[SYNC] Skipping duplicate agent: ${agent.name} (${agent.externalId})`);
                        return false;
                    }
                    dedupIds.add(agent.externalId);
                    return true;
                });

                console.log(`[SYNC] ${label}: syncing ${externalAgents.length} unique ${provider} agents (${rawAgents.length} raw)`);

                // Fetch existing agents for this agency/provider
                const { data: existingAgents, error: fetchError } = await supabase
                    .from('agents')
                    .select('id, external_id, name')
                    .eq('agency_id', user.agency.id)
                    .eq('provider', provider);

                if (fetchError) {
                    console.error(`[SYNC] ${label}: error fetching existing agents:`, fetchError.code);
                    results.agents.errors += externalAgents.length;
                    continue;
                }

                const existingMap = new Map(
                    existingAgents?.map(a => [a.external_id, a]) || []
                );

                // Prepare batch upsert data
                const toUpsert = externalAgents.map(extAgent => {
                    const existing = existingMap.get(extAgent.externalId);
                    if (existing) {
                        console.log(`[SYNC] ${label}: will update agent ${existing.id} "${existing.name}" → "${extAgent.name}"`);
                    } else {
                        console.log(`[SYNC] ${label}: will insert new agent: ${extAgent.name}`);
                    }

                    return {
                        agency_id: user.agency.id,
                        ...(clientId ? { client_id: clientId } : {}),
                        name: extAgent.name,
                        provider,
                        external_id: extAgent.externalId,
                        config: extAgent.config,
                        updated_at: new Date().toISOString(),
                    };
                });

                if (toUpsert.length > 0) {
                    const { error: upsertError, data: upsertedData } = await supabase
                        .from('agents')
                        .upsert(toUpsert, {
                            onConflict: 'agency_id,provider,external_id',
                            ignoreDuplicates: false,
                        })
                        .select('id');

                    if (upsertError) {
                        console.error(`[SYNC] ${label}: batch upsert error:`, upsertError.code);
                        results.agents.errors += toUpsert.length;
                    } else {
                        results.agents.synced += toUpsert.length;
                        console.log(`[SYNC] ${label}: upserted ${upsertedData?.length || toUpsert.length} agents`);
                    }
                }

                // Ensure Retell agents have required webhook_events configured
                if (provider === 'retell') {
                    try {
                        const retellAgents = await listRetellAgents(apiKey);
                        const retellMap = new Map(retellAgents.map(a => [a.agent_id, a]));

                        let patchedCount = 0;
                        for (const extAgent of externalAgents) {
                            const retellAgent = retellMap.get(extAgent.externalId);
                            if (!retellAgent) continue;
                            try {
                                const patched = await ensureAgentWebhookConfig(apiKey, retellAgent);
                                if (patched) patchedCount++;
                            } catch (err) {
                                console.error(`[SYNC] ${label}: failed to patch agent ${extAgent.externalId}:`, err instanceof Error ? err.message : 'Unknown error');
                            }
                        }
                        if (patchedCount > 0) {
                            console.log(`[SYNC] ${label}: patched webhook config on ${patchedCount} agents (events=${REQUIRED_WEBHOOK_EVENTS.join(',')})`);
                        }
                    } catch (err) {
                        console.error(`[SYNC] ${label}: failed to ensure webhook configs:`, err instanceof Error ? err.message : 'Unknown error');
                    }
                }
            } catch (err) {
                console.error(`[SYNC] ${label}: error syncing ${provider} agents:`, err instanceof Error ? err.message : 'Unknown error');
            }

            // ─── Sync Calls ───
            try {
                const externalCalls: NormalizedCall[] = await providerClient.listCalls({ limit: 100 });
                console.log(`[SYNC] ${label}: fetched ${externalCalls.length} ${provider} calls`);

                // Fetch agent mapping
                const { data: dbAgents } = await supabase
                    .from('agents')
                    .select('id, external_id, client_id')
                    .eq('agency_id', user.agency.id)
                    .eq('provider', provider);

                const agentMap = new Map(
                    dbAgents?.map(a => [a.external_id, { id: a.id, client_id: a.client_id }]) || []
                );

                // Filter calls that have matching agents
                const callsWithAgents: { call: NormalizedCall; agentInfo: { id: string; client_id: string | null } }[] = [];
                let unmatchedCalls = 0;

                for (const extCall of externalCalls) {
                    const agentInfo = agentMap.get(extCall.agentExternalId);
                    if (!agentInfo) {
                        if (unmatchedCalls < 3) {
                            console.log(`[SYNC] ${label}: no match for call agent "${extCall.agentExternalId}"`);
                        }
                        unmatchedCalls++;
                        continue;
                    }
                    callsWithAgents.push({ call: extCall, agentInfo });
                }

                console.log(`[SYNC] ${label}: ${callsWithAgents.length} calls matched, ${unmatchedCalls} unmatched`);

                if (callsWithAgents.length === 0) {
                    continue;
                }

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

                if (callsToUpsert.length > 0) {
                    const { error: callUpsertError } = await supabase
                        .from('calls')
                        .upsert(callsToUpsert, {
                            onConflict: 'external_id',
                            ignoreDuplicates: false,
                        });

                    if (callUpsertError) {
                        console.error(`[SYNC] ${label}: call upsert error:`, callUpsertError.code);
                        results.calls.errors += callsToUpsert.length;
                        results.calls.errorDetails = 'Failed to upsert calls';
                    } else {
                        results.calls.synced += callsToUpsert.length;
                        console.log(`[SYNC] ${label}: upserted ${callsToUpsert.length} calls`);
                    }
                }
            } catch (err) {
                console.error(`[SYNC] ${label}: error syncing ${provider} calls:`, err instanceof Error ? err.message : 'Unknown error');
            }
        }

        return NextResponse.json({
            message: 'Sync completed',
            results,
        });
    } catch (error) {
        console.error('Error during sync:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
