import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getProviderClient, type NormalizedAgent } from '@/lib/providers';
import { listRetellAgents, ensureAgentWebhookConfig, REQUIRED_WEBHOOK_EVENTS } from '@/lib/providers/retell';
import { listVapiAssistants, updateVapiAssistant } from '@/lib/providers/vapi';
import type { VoiceProvider } from '@/types';
import { decrypt } from '@/lib/crypto';
import { PROVIDER_KEY_MAP, PROVIDER_KEY_SELECT, type ProviderKeyRow } from '@/lib/constants/config';
const PROVIDER_API_TIMEOUT = 15_000;

/** One workspace to sync: a provider + API key + optional client scope */
interface SyncEntry {
    provider: VoiceProvider;
    apiKey: string;
    clientId: string | null;
    label: string;
}

const KEY_FIELDS = (Object.entries(PROVIDER_KEY_MAP) as [VoiceProvider, string][]).map(
    ([provider, field]) => ({ field, provider })
);

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

        // Get agencies that haven't been synced in the last 30 minutes.
        // This prevents re-syncing agencies that were just synced and
        // ensures the cron completes within Vercel's timeout by processing
        // only a subset each run.
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: agencies, error: agenciesError } = await supabase
            .from('agencies')
            .select(`id, name, ${PROVIDER_KEY_SELECT}`)
            .or(`updated_at.lt.${thirtyMinutesAgo},updated_at.is.null`)
            .limit(100) as { data: (ProviderKeyRow & { id: string; name: string; [key: string]: string | null })[] | null; error: { code: string } | null }; // Process up to 100 per cron run (fits within 60s timeout)

        if (agenciesError) {
            console.error('Error fetching agencies:', agenciesError.code);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!agencies || agencies.length === 0) {
            return NextResponse.json({ message: 'No agencies to sync', synced: 0 });
        }

        console.info(`[CRON SYNC] Starting sync for ${agencies.length} agencies`);

        const results = {
            agencies_synced: 0,
            total_agents: 0,
            total_phone_numbers: 0,
            errors: [] as string[],
        };

        const successfulAgencyIds: string[] = [];

        // Process agencies in parallel batches of 5 to avoid Vercel timeout
        const BATCH_SIZE = 5;
        for (let i = 0; i < agencies.length; i += BATCH_SIZE) {
            const batch = agencies.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.allSettled(batch.map(async (agency) => {
                // Build sync entries: agency-level + client-level keys (deduped)
                const syncEntries: SyncEntry[] = [];
                const seenApiKeys = new Set<string>();

                // Agency-level keys first (decrypt from DB)
                for (const { field, provider } of KEY_FIELDS) {
                    const raw = agency[field];
                    const key = decrypt(raw) ?? raw;
                    if (key) {
                        syncEntries.push({ provider, apiKey: key, clientId: null, label: `agency ${agency.id}` });
                        seenApiKeys.add(key);
                    }
                }

                // Client-level keys (skip duplicates of agency keys)
                const { data: clientsWithKeys } = await supabase
                    .from('clients')
                    .select(`id, name, ${PROVIDER_KEY_SELECT}`)
                    .eq('agency_id', agency.id)
                    .or('retell_api_key.neq.null,vapi_api_key.neq.null,bland_api_key.neq.null,elevenlabs_api_key.neq.null')
                    .limit(500) as { data: (ProviderKeyRow & { id: string; name: string; [key: string]: string | null })[] | null };

                for (const clientRecord of clientsWithKeys || []) {
                    for (const { field, provider } of KEY_FIELDS) {
                        const raw = clientRecord[field];
                        const key = decrypt(raw) ?? raw;
                        if (key && !seenApiKeys.has(key)) {
                            syncEntries.push({ provider, apiKey: key, clientId: clientRecord.id, label: `client "${clientRecord.name}"` });
                            seenApiKeys.add(key);
                        }
                    }
                }

                if (syncEntries.length === 0) return;

                // Sync agents, webhook configs, and phone numbers from each workspace
                for (const entry of syncEntries) {
                    const { provider, apiKey, clientId, label } = entry;

                    try {
                        const providerClient = getProviderClient(provider, apiKey);

                        // ─── Sync Agents ───
                        const externalAgents: NormalizedAgent[] = await providerClient.listAgents();

                        // Skip agents that were assigned via platform admin (key_source: 'platform')
                        // to prevent sync from overwriting their agency/client assignment
                        const { data: platformAgents } = await supabase
                            .from('agents')
                            .select('external_id')
                            .eq('agency_id', agency.id)
                            .eq('provider', provider)
                            .filter('config->>key_source', 'eq', 'platform');

                        const platformExternalIds = new Set((platformAgents || []).map(a => a.external_id));

                        const agentsToUpsert = externalAgents
                            .filter(extAgent => !platformExternalIds.has(extAgent.externalId))
                            .map(extAgent => ({
                                agency_id: agency.id,
                                ...(clientId ? { client_id: clientId } : {}),
                                name: extAgent.name,
                                provider,
                                external_id: extAgent.externalId,
                                config: extAgent.config,
                                updated_at: new Date().toISOString(),
                            }));

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
                                console.info(`[CRON SYNC] ${label}: upserted ${agentsToUpsert.length} ${provider} agents`);
                            } else {
                                console.error(`[CRON SYNC] ${label}: agent upsert error:`, agentUpsertError.code);
                            }
                        }

                        // ─── Ensure Retell webhook config ───
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
                                        console.error(`[CRON SYNC] ${label}: failed to patch agent ${extAgent.externalId}:`, err instanceof Error ? err.message : 'Unknown error');
                                    }
                                }
                                if (patchedCount > 0) {
                                    console.info(`[CRON SYNC] ${label}: patched webhook config on ${patchedCount} agents (events=${REQUIRED_WEBHOOK_EVENTS.join(',')})`);
                                }
                            } catch (err) {
                                console.error(`[CRON SYNC] ${label}: failed to ensure webhook configs:`, err instanceof Error ? err.message : 'Unknown error');
                            }
                        }

                        // ─── Ensure Vapi serverUrl ───
                        if (provider === 'vapi' && process.env.NEXT_PUBLIC_APP_URL) {
                            try {
                                const expectedServerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/vapi`;
                                const vapiAssistants = await listVapiAssistants(apiKey);
                                const vapiExternalIds = new Set(externalAgents.map(a => a.externalId));
                                let patchedCount = 0;
                                for (const assistant of vapiAssistants) {
                                    if (!vapiExternalIds.has(assistant.id)) continue;
                                    if (assistant.serverUrl === expectedServerUrl) continue;
                                    try {
                                        await updateVapiAssistant(apiKey, assistant.id, { serverUrl: expectedServerUrl });
                                        patchedCount++;
                                    } catch (err) {
                                        console.error(`[CRON SYNC] ${label}: failed to patch Vapi serverUrl for ${assistant.id}:`, err instanceof Error ? err.message : 'Unknown error');
                                    }
                                }
                                if (patchedCount > 0) {
                                    console.info(`[CRON SYNC] ${label}: patched serverUrl on ${patchedCount} Vapi assistants`);
                                }
                            } catch (err) {
                                console.error(`[CRON SYNC] ${label}: failed to ensure Vapi serverUrl:`, err instanceof Error ? err.message : 'Unknown error');
                            }
                        }

                        // ─── Sync Phone Numbers ───
                        // Build agent lookup for phone→agent linking
                        const { data: agencyAgents } = await supabase
                            .from('agents')
                            .select('id, external_id')
                            .eq('agency_id', agency.id);

                        const agentLookupMap = new Map(
                            agencyAgents?.map(a => [a.external_id, a.id]) || []
                        );

                        if (provider === 'retell') {
                            try {
                                const phoneResponse = await fetch('https://api.retellai.com/list-phone-numbers', {
                                    method: 'GET',
                                    headers: { 'Authorization': `Bearer ${apiKey}` },
                                    signal: AbortSignal.timeout(PROVIDER_API_TIMEOUT),
                                });

                                if (phoneResponse.ok) {
                                    const phoneNumbers = await phoneResponse.json();
                                    if (phoneNumbers.length > 0) {
                                        const phonesToUpsert = phoneNumbers.map((phone: {
                                            phone_number_id?: string;
                                            phone_number: string;
                                            nickname?: string;
                                            inbound_agents?: { agent_id: string; weight: number }[];
                                            inbound_agent_id?: string; // deprecated fallback
                                        }) => {
                                            // Prefer new weighted agent list, fall back to deprecated field
                                            const inboundRetellId = phone.inbound_agents?.[0]?.agent_id
                                                ?? phone.inbound_agent_id ?? null;
                                            return {
                                                agency_id: agency.id,
                                                external_id: phone.phone_number_id || phone.phone_number,
                                                phone_number: phone.phone_number,
                                                nickname: phone.nickname || null,
                                                provider: 'retell',
                                                status: 'active',
                                                agent_id: inboundRetellId
                                                    ? agentLookupMap.get(inboundRetellId) || null
                                                    : null,
                                                updated_at: new Date().toISOString(),
                                            };
                                        });

                                        const { error: phoneUpsertError, data: upsertedPhones } = await supabase
                                            .from('phone_numbers')
                                            .upsert(phonesToUpsert, {
                                                onConflict: 'agency_id,external_id',
                                                ignoreDuplicates: false,
                                            })
                                            .select('id');

                                        if (!phoneUpsertError) {
                                            results.total_phone_numbers += upsertedPhones?.length || phonesToUpsert.length;
                                            console.info(`[CRON SYNC] ${label}: upserted ${phonesToUpsert.length} Retell phone numbers`);
                                        } else {
                                            console.error(`[CRON SYNC] ${label}: phone upsert error:`, phoneUpsertError.code);
                                        }
                                    }
                                }
                            } catch (phoneErr) {
                                console.error(`[CRON SYNC] ${label}: Retell phone sync error:`, phoneErr instanceof Error ? phoneErr.message : 'Unknown error');
                            }
                        }

                        if (provider === 'vapi') {
                            try {
                                const { listVapiPhoneNumbers } = await import('@/lib/providers/vapi');
                                const vapiNumbers = await listVapiPhoneNumbers(apiKey);

                                if (vapiNumbers.length > 0) {
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
                                        console.info(`[CRON SYNC] ${label}: upserted ${phonesToUpsert.length} Vapi phone numbers`);
                                    } else {
                                        console.error(`[CRON SYNC] ${label}: Vapi phone upsert error:`, phoneUpsertError.code);
                                    }
                                }
                            } catch (phoneErr) {
                                console.error(`[CRON SYNC] ${label}: Vapi phone sync error:`, phoneErr instanceof Error ? phoneErr.message : 'Unknown error');
                            }
                        }

                        if (provider === 'bland') {
                            try {
                                const { listBlandPhoneNumbers } = await import('@/lib/providers/bland');
                                const blandNumbers = await listBlandPhoneNumbers(apiKey);

                                if (blandNumbers.length > 0) {
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
                                        console.info(`[CRON SYNC] ${label}: upserted ${phonesToUpsert.length} Bland phone numbers`);
                                    } else {
                                        console.error(`[CRON SYNC] ${label}: Bland phone upsert error:`, phoneUpsertError.code);
                                    }
                                }
                            } catch (phoneErr) {
                                console.error(`[CRON SYNC] ${label}: Bland phone sync error:`, phoneErr instanceof Error ? phoneErr.message : 'Unknown error');
                            }
                        }
                    } catch (providerErr) {
                        console.error(`[CRON SYNC] ${label}: ${provider} sync error:`, providerErr instanceof Error ? providerErr.message : 'Unknown error');
                        results.errors.push(`${label}: ${provider} sync failed`);
                    }
                }

                results.agencies_synced++;
                successfulAgencyIds.push(agency.id);
            }));

            for (const result of batchResults) {
                if (result.status === 'rejected') {
                    const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error';
                    console.error('Agency sync error:', errMsg);
                    results.errors.push(`Agency sync failed: ${errMsg}`);
                }
            }
        }

        // Update last sync timestamp only for successfully synced agencies
        if (successfulAgencyIds.length > 0) {
            await supabase
                .from('agencies')
                .update({ updated_at: new Date().toISOString() })
                .in('id', successfulAgencyIds);
        }

        // Auto-complete experiments that have passed their end_date
        try {
            const { data: expiredExperiments } = await supabase
                .from('experiments')
                .select('id, name')
                .eq('status', 'running')
                .lt('end_date', new Date().toISOString())
                .not('end_date', 'is', null);

            if (expiredExperiments && expiredExperiments.length > 0) {
                const { error: expUpdateErr } = await supabase
                    .from('experiments')
                    .update({ status: 'paused', updated_at: new Date().toISOString() })
                    .in('id', expiredExperiments.map(e => e.id));

                if (!expUpdateErr) {
                    console.info(`[CRON SYNC] Auto-paused ${expiredExperiments.length} expired experiments`);
                }
            }
        } catch (expErr) {
            console.error('[CRON SYNC] Experiment auto-completion error:', expErr instanceof Error ? expErr.message : 'Unknown error');
        }

        console.info(`[CRON SYNC] Complete:`, results);

        return NextResponse.json({
            message: 'Sync completed',
            ...results,
        });
    } catch (error) {
        console.error('[CRON SYNC] Fatal error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
