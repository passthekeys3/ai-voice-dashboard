import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/server';
import { ManagedAccountsTable } from '@/components/admin/ManagedAccountsTable';
import { getTierFromPriceId } from '@/lib/billing/tiers';

export const metadata = {
    title: 'Managed Accounts | Admin',
};

export default async function AdminAccountsPage() {
    const user = await requireAuth();

    // Gate: only platform admins can access
    if (!isPlatformAdmin(user.email)) {
        redirect('/');
    }

    const supabase = createServiceClient();

    // Fetch all agencies (admin can filter by plan_type in the UI)
    const { data: agencies, error } = await supabase
        .from('agencies')
        .select('id, name, subscription_status, subscription_price_id, plan_type, is_beta, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[ADMIN] Failed to fetch agencies:', error.code);
    }

    const agencyList = agencies || [];
    const agencyIds = agencyList.map(a => a.id);

    // Parallel fetch: agent counts, client counts, and usage stats
    let agentCounts: Record<string, number> = {};
    let clientCounts: Record<string, number> = {};
    let usageStats: Record<string, { minutes: number; cost_cents: number }> = {};

    if (agencyIds.length > 0) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [agentResult, clientResult, agentIdsResult] = await Promise.all([
            supabase.from('agents').select('agency_id').in('agency_id', agencyIds),
            supabase.from('clients').select('agency_id').in('agency_id', agencyIds),
            supabase.from('agents').select('id, agency_id').in('agency_id', agencyIds),
        ]);

        if (agentResult.data) {
            agentCounts = agentResult.data.reduce<Record<string, number>>((acc, row) => {
                acc[row.agency_id] = (acc[row.agency_id] || 0) + 1;
                return acc;
            }, {});
        }

        if (clientResult.data) {
            clientCounts = clientResult.data.reduce<Record<string, number>>((acc, row) => {
                acc[row.agency_id] = (acc[row.agency_id] || 0) + 1;
                return acc;
            }, {});
        }

        // Build agent_id → agency_id map for usage aggregation
        const agentToAgency: Record<string, string> = {};
        if (agentIdsResult.data) {
            for (const row of agentIdsResult.data) {
                agentToAgency[row.id] = row.agency_id;
            }
        }

        const allAgentIds = Object.keys(agentToAgency);
        if (allAgentIds.length > 0) {
            const { data: calls } = await supabase
                .from('calls')
                .select('agent_id, duration_seconds, cost_cents')
                .in('agent_id', allAgentIds)
                .gte('started_at', startOfMonth);

            if (calls) {
                for (const call of calls) {
                    const aid = agentToAgency[call.agent_id];
                    if (!aid) continue;
                    if (!usageStats[aid]) usageStats[aid] = { minutes: 0, cost_cents: 0 };
                    usageStats[aid].minutes += (call.duration_seconds || 0) / 60;
                    usageStats[aid].cost_cents += call.cost_cents || 0;
                }
            }
        }
    }

    // Enrich agencies with counts, tier, and usage
    const enrichedAgencies = agencyList.map(a => {
        const tierInfo = getTierFromPriceId(a.subscription_price_id || '');
        const usage = usageStats[a.id];
        return {
            id: a.id,
            name: a.name,
            subscription_status: a.subscription_status,
            plan_type: (a.plan_type as 'self_service' | 'managed') || 'self_service',
            plan_tier: tierInfo?.tier || null,
            is_beta: a.is_beta ?? false,
            created_at: a.created_at,
            agent_count: agentCounts[a.id] || 0,
            client_count: clientCounts[a.id] || 0,
            usage_minutes: usage ? Math.round(usage.minutes) : 0,
            usage_cost: usage ? Math.round(usage.cost_cents) / 100 : 0,
        };
    });

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Admin: Managed Accounts</h1>
            <ManagedAccountsTable agencies={enrichedAgencies} />
        </div>
    );
}
