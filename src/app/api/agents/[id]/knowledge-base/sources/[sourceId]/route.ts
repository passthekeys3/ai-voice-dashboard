import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import * as retell from '@/lib/providers/retell';

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
        const supabase = createServiceClient();

        const { data: agent } = await supabase
            .from('agents')
            .select('id, config, agency_id')
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

        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key' }, { status: 400 });
        }

        await retell.deleteRetellKBSource(agency.retell_api_key, kbId, sourceId);

        return NextResponse.json({ message: 'Source deleted' });
    } catch (error) {
        console.error('Error deleting source:', error);
        return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
    }
}
