import { NextRequest, NextResponse } from 'next/server';
import type { VoiceProvider } from '@/types';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import * as retell from '@/lib/providers/retell';
import * as vapiKb from '@/lib/providers/vapi-kb';
import * as blandKb from '@/lib/providers/bland-kb';
import { isValidUuid } from '@/lib/validation';
import { withErrorHandling } from '@/lib/api/response';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/** Normalized KB shape returned to the client */
interface NormalizedKB {
    knowledge_base_id: string;
    knowledge_base_name: string;
    status: string;
    knowledge_base_sources?: Array<{
        source_id: string;
        source_type: 'file' | 'url' | 'text';
        source_name?: string;
        source_url?: string;
        status?: string;
    }>;
}

// GET /api/agents/[id]/knowledge-base - Get KB for agent
export const GET = withErrorHandling(async (request: NextRequest, { params }: RouteParams) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: agentId } = await params;
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = createServiceClient();

        // Verify agent belongs to agency
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, agency_id, client_id, provider, external_id, config')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // For client users, verify they have access to this agent
        if (user.profile.client_id && agent.client_id !== user.profile.client_id) {
            return NextResponse.json({ error: 'You do not have access to this agent' }, { status: 403 });
        }

        // Resolve provider API key
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json({ error: `No ${agent.provider} API key configured` }, { status: 400 });
        }

        // Check if agent has a knowledge base ID in config
        const kbId = agent.config?.knowledge_base_id;
        // Bland stores multiple KB IDs
        const blandKbIds: string[] = agent.config?.bland_kb_ids || [];

        if (!kbId && blandKbIds.length === 0) {
            return NextResponse.json({
                data: null,
                message: 'No knowledge base configured for this agent'
            });
        }

        try {
            let normalized: NormalizedKB;

            if (agent.provider === 'retell') {
                const kb = await retell.getRetellKnowledgeBase(apiKey, kbId);
                normalized = {
                    knowledge_base_id: kb.knowledge_base_id,
                    knowledge_base_name: kb.knowledge_base_name,
                    status: kb.status,
                    knowledge_base_sources: kb.knowledge_base_sources?.map(s => ({
                        source_id: s.source_id,
                        source_type: s.source_type,
                        source_name: s.source_name,
                        source_url: s.source_url,
                        status: s.status,
                    })),
                };
            } else if (agent.provider === 'vapi') {
                const kb = await vapiKb.getVapiKBNormalized(apiKey, kbId);
                normalized = {
                    knowledge_base_id: kb.id,
                    knowledge_base_name: kb.name,
                    status: kb.status,
                    knowledge_base_sources: kb.sources.map(s => ({
                        source_id: s.source_id,
                        source_type: s.source_type,
                        source_name: s.source_name,
                        status: s.status,
                    })),
                };
            } else if (agent.provider === 'bland') {
                const ids = blandKbIds.length > 0 ? blandKbIds : (kbId ? [kbId] : []);
                const kb = await blandKb.getBlandKBsNormalized(apiKey, ids);
                normalized = {
                    knowledge_base_id: kb.id,
                    knowledge_base_name: kb.name,
                    status: kb.status,
                    knowledge_base_sources: kb.sources.map(s => ({
                        source_id: s.source_id,
                        source_type: s.source_type,
                        source_name: s.source_name,
                        source_url: s.source_url,
                        status: s.status,
                    })),
                };
            } else {
                return NextResponse.json({ error: `Knowledge bases not supported for ${agent.provider}` }, { status: 400 });
            }

            return NextResponse.json({ data: normalized });
        } catch (err) {
            console.error('Error fetching KB:', err instanceof Error ? err.message : 'Unknown error');
            return NextResponse.json({
                data: null,
                message: 'Knowledge base not found'
            });
        }
    } catch (error) {
        console.error('Error in KB GET:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

// POST /api/agents/[id]/knowledge-base - Create KB for agent
export const POST = withErrorHandling(async (request: NextRequest, { params }: RouteParams) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = createServiceClient();

        // Verify agent
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, agency_id, client_id, provider, config')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Resolve provider API key
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json({ error: `No ${agent.provider} API key configured` }, { status: 400 });
        }

        const kbName = `${agent.name} KB`.slice(0, 40);
        let kbIdToStore: string;

        if (agent.provider === 'retell') {
            const kb = await retell.createRetellKnowledgeBase(apiKey, {
                knowledge_base_name: kbName,
            });
            kbIdToStore = kb.knowledge_base_id;
        } else if (agent.provider === 'vapi') {
            // Vapi: create an empty KB (files added via sources endpoint)
            const kb = await vapiKb.createVapiKnowledgeBase(apiKey, {
                name: kbName,
                fileIds: [],
            });
            kbIdToStore = kb.id;
        } else if (agent.provider === 'bland') {
            // Bland: each source is its own KB, so we just mark the agent as KB-enabled
            // The actual KB IDs are stored in bland_kb_ids array when sources are added
            kbIdToStore = '__bland_kb_enabled__';
        } else {
            return NextResponse.json({ error: `Knowledge bases not supported for ${agent.provider}` }, { status: 400 });
        }

        // Update agent config with KB ID
        const updatedConfig = {
            ...agent.config,
            knowledge_base_id: kbIdToStore,
        };

        const { error: updateError } = await supabase
            .from('agents')
            .update({ config: updatedConfig })
            .eq('id', agentId)
            .eq('agency_id', user.agency.id);

        if (updateError) {
            console.error('Error saving KB config:', updateError.code);
            return NextResponse.json({ error: 'Failed to save knowledge base configuration' }, { status: 500 });
        }

        return NextResponse.json({
            data: {
                knowledge_base_id: kbIdToStore,
                knowledge_base_name: kbName,
                status: 'in_progress',
            },
            message: 'Knowledge base created successfully'
        });
    } catch (error: unknown) {
        console.error('Error creating KB:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Failed to create knowledge base' }, { status: 500 });
    }
});

// DELETE /api/agents/[id]/knowledge-base - Delete KB for agent
export const DELETE = withErrorHandling(async (request: NextRequest, { params }: RouteParams) => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = createServiceClient();

        const { data: agent } = await supabase
            .from('agents')
            .select('id, config, agency_id, client_id, provider')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const kbId = agent.config?.knowledge_base_id;
        const blandKbIds: string[] = agent.config?.bland_kb_ids || [];

        if (!kbId && blandKbIds.length === 0) {
            return NextResponse.json({ error: 'No knowledge base to delete' }, { status: 400 });
        }

        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as VoiceProvider);

        if (!apiKey) {
            return NextResponse.json({ error: `No ${agent.provider} API key configured` }, { status: 400 });
        }

        // Delete from provider — fail the request if the primary deletion fails
        // to avoid orphaning resources on the provider side
        if (agent.provider === 'retell') {
            await retell.deleteRetellKnowledgeBase(apiKey, kbId);
        } else if (agent.provider === 'vapi') {
            // Delete the KB first (must succeed), then clean up files (best effort)
            const kb = await vapiKb.getVapiKnowledgeBase(apiKey, kbId);
            await vapiKb.deleteVapiKnowledgeBase(apiKey, kbId);
            if (kb.fileIds) {
                for (const fileId of kb.fileIds) {
                    try { await vapiKb.deleteVapiFile(apiKey, fileId); } catch { /* best effort */ }
                }
            }
        } else if (agent.provider === 'bland') {
            // Delete all Bland KBs — collect failures but still clean up config
            const failures: string[] = [];
            for (const id of blandKbIds) {
                try { await blandKb.deleteBlandKnowledgeBase(apiKey, id); } catch { failures.push(id); }
            }
            if (failures.length > 0) {
                console.warn(`Failed to delete ${failures.length} Bland KBs: ${failures.join(', ')}`);
            }
        }

        // Remove KB IDs from agent config
        const updatedConfig = { ...agent.config };
        delete updatedConfig.knowledge_base_id;
        delete updatedConfig.bland_kb_ids;

        const { error: updateError } = await supabase
            .from('agents')
            .update({ config: updatedConfig })
            .eq('id', agentId)
            .eq('agency_id', user.agency.id);

        if (updateError) {
            console.error('Error removing KB config:', updateError.code);
            return NextResponse.json({ error: 'Failed to remove knowledge base configuration' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Knowledge base deleted' });
    } catch (error) {
        console.error('Error deleting KB:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
