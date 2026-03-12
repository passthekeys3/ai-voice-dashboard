import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import * as retell from '@/lib/providers/retell';
import * as vapiKb from '@/lib/providers/vapi-kb';
import * as blandKb from '@/lib/providers/bland-kb';
import { isValidUuid } from '@/lib/validation';

interface RouteParams {
    params: Promise<{ id: string; sourceId: string }>;
}

// DELETE /api/agents/[id]/knowledge-base/sources/[sourceId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId, sourceId } = await params;
        if (!isValidUuid(agentId)) {
            return NextResponse.json({ error: 'Invalid agent ID format' }, { status: 400 });
        }
        // sourceId may not be a UUID for all providers (Vapi uses custom IDs, Bland uses kb_ prefix)
        if (!sourceId || sourceId.length > 200 || !/^[a-zA-Z0-9_\-:.]+$/.test(sourceId)) {
            return NextResponse.json({ error: 'Invalid source ID' }, { status: 400 });
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
        if (!kbId) {
            return NextResponse.json({ error: 'No knowledge base' }, { status: 400 });
        }

        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id, agent.client_id);
        const apiKey = getProviderKey(resolvedKeys, agent.provider as 'retell' | 'vapi' | 'bland');

        if (!apiKey) {
            return NextResponse.json({ error: `No ${agent.provider} API key configured` }, { status: 400 });
        }

        if (agent.provider === 'retell') {
            await retell.deleteRetellKBSource(apiKey, kbId, sourceId);

        } else if (agent.provider === 'vapi') {
            // Vapi: remove file from KB's fileIds, then delete the file
            const kb = await vapiKb.getVapiKnowledgeBase(apiKey, kbId);
            const updatedFileIds = (kb.fileIds || []).filter(fid => fid !== sourceId);
            await vapiKb.updateVapiKnowledgeBase(apiKey, kbId, { fileIds: updatedFileIds });
            try { await vapiKb.deleteVapiFile(apiKey, sourceId); } catch { /* best effort */ }

        } else if (agent.provider === 'bland') {
            // Bland: delete the individual KB and remove from config
            try { await blandKb.deleteBlandKnowledgeBase(apiKey, sourceId); } catch { /* best effort */ }
            const existingIds: string[] = (agent.config?.bland_kb_ids as string[]) || [];
            const updatedIds = existingIds.filter(id => id !== sourceId);
            await supabase
                .from('agents')
                .update({ config: { ...agent.config, bland_kb_ids: updatedIds } })
                .eq('id', agentId)
                .eq('agency_id', user.agency.id);
        }

        return NextResponse.json({ message: 'Source deleted' });
    } catch (error) {
        console.error('Error deleting source:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
    }
}
