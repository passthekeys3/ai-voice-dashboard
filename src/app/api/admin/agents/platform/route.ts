import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/server';
import { listRetellAgents } from '@/lib/providers/retell';

/**
 * GET /api/admin/agents/platform
 *
 * Lists all agents on the PLATFORM_RETELL_API_KEY account,
 * cross-referenced with DB to show which are assigned to which agency.
 * Platform admin only.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !isPlatformAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const platformKey = process.env.PLATFORM_RETELL_API_KEY;
        if (!platformKey) {
            return NextResponse.json(
                { error: 'PLATFORM_RETELL_API_KEY is not configured' },
                { status: 400 }
            );
        }

        // Fetch all agents from the platform Retell account
        const retellAgents = await listRetellAgents(platformKey);

        // Fetch all platform-assigned agents from DB
        const supabase = createServiceClient();
        const externalIds = retellAgents.map(a => a.agent_id);

        // Skip DB query if no agents on the Retell account
        let dbAgents: { external_id: string; agency_id: string; client_id: string | null; name: string }[] = [];
        if (externalIds.length > 0) {
            const { data } = await supabase
                .from('agents')
                .select('external_id, agency_id, client_id, name')
                .eq('provider', 'retell')
                .filter('config->>key_source', 'eq', 'platform')
                .in('external_id', externalIds);
            dbAgents = data || [];
        }

        // Fetch agency names for assigned agents
        const assignedAgencyIds = [...new Set(dbAgents.map(a => a.agency_id))];
        let agencies: { id: string; name: string }[] = [];
        if (assignedAgencyIds.length > 0) {
            const { data } = await supabase
                .from('agencies')
                .select('id, name')
                .in('id', assignedAgencyIds);
            agencies = data || [];
        }

        const agencyMap = new Map((agencies || []).map(a => [a.id, a.name]));
        const dbMap = new Map((dbAgents || []).map(a => [a.external_id, a]));

        const agents = retellAgents.map(agent => {
            const dbAgent = dbMap.get(agent.agent_id);
            return {
                external_id: agent.agent_id,
                name: agent.agent_name,
                voice_id: agent.voice_id,
                created_at: agent.created_at,
                assigned_agency_id: dbAgent?.agency_id || null,
                assigned_agency_name: dbAgent ? agencyMap.get(dbAgent.agency_id) || null : null,
                assigned_client_id: dbAgent?.client_id || null,
            };
        });

        return NextResponse.json({ agents });
    } catch (error) {
        console.error('[ADMIN] Platform agents error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
