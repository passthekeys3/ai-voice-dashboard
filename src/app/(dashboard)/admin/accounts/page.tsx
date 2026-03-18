import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/server';
import { ManagedAccountsTable } from '@/components/admin/ManagedAccountsTable';

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
        .select('id, name, subscription_status, plan_type, is_beta, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[ADMIN] Failed to fetch agencies:', error.code);
    }

    const agencyList = agencies || [];

    // Batch-fetch agent and client counts for all agency IDs
    const agencyIds = agencyList.map(a => a.id);
    let agentCounts: Record<string, number> = {};
    let clientCounts: Record<string, number> = {};

    if (agencyIds.length > 0) {
        // Agent counts
        const { data: agentData } = await supabase
            .from('agents')
            .select('agency_id')
            .in('agency_id', agencyIds);

        if (agentData) {
            agentCounts = agentData.reduce<Record<string, number>>((acc, row) => {
                acc[row.agency_id] = (acc[row.agency_id] || 0) + 1;
                return acc;
            }, {});
        }

        // Client counts
        const { data: clientData } = await supabase
            .from('clients')
            .select('agency_id')
            .in('agency_id', agencyIds);

        if (clientData) {
            clientCounts = clientData.reduce<Record<string, number>>((acc, row) => {
                acc[row.agency_id] = (acc[row.agency_id] || 0) + 1;
                return acc;
            }, {});
        }
    }

    // Enrich agencies with counts
    const enrichedAgencies = agencyList.map(a => ({
        id: a.id,
        name: a.name,
        subscription_status: a.subscription_status,
        plan_type: (a.plan_type as 'self_service' | 'managed') || 'self_service',
        is_beta: a.is_beta ?? false,
        created_at: a.created_at,
        agent_count: agentCounts[a.id] || 0,
        client_count: clientCounts[a.id] || 0,
    }));

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Admin: Managed Accounts</h1>
            <ManagedAccountsTable agencies={enrichedAgencies} />
        </div>
    );
}
