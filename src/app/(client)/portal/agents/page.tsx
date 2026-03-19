import type { Metadata } from 'next';

import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions } from '@/lib/permissions';
import { Header } from '@/components/dashboard/Header';
import { FilterableAgentGrid } from '@/components/dashboard/FilterableAgentGrid';
import { CreateAgentButton } from '@/components/dashboard/CreateAgentButton';
import type { Agent } from '@/types';

export const metadata: Metadata = { title: 'Agents' };

export default async function ClientAgentsPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const permissions = getUserPermissions(user);
    const canCreate = permissions.can_create_agents;

    let query = supabase
        .from('agents')
        .select('*, clients(name)')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    if (user.client) {
        query = query.eq('client_id', user.client.id);
    }

    const { data: agents } = await query;

    // Fetch phone numbers scoped to this client's agents only
    const clientAgentIds = (agents || []).map(a => a.id);
    let phoneNumbers: { id: string; phone_number: string; agent_id: string | null }[] = [];
    if (clientAgentIds.length > 0) {
        const { data: pnData } = await supabase
            .from('phone_numbers')
            .select('id, phone_number, agent_id')
            .eq('agency_id', user.agency.id)
            .eq('status', 'active')
            .in('agent_id', clientAgentIds);
        phoneNumbers = pnData || [];
    }

    const agentPhoneMap: Record<string, string> = {};
    phoneNumbers.forEach(pn => {
        if (pn.agent_id) {
            agentPhoneMap[pn.agent_id] = pn.phone_number;
        }
    });

    // For client users, restrict the clients list to their own client only
    let clients: { id: string; name: string }[] = [];
    if (canCreate && user.client) {
        clients = [{ id: user.client.id, name: user.client.name }];
    }

    // Determine which providers the agency has configured
    const availableProviders = [
        ...(user.agency.retell_api_key ? ['retell' as const] : []),
        ...(user.agency.vapi_api_key ? ['vapi' as const] : []),
        ...(user.agency.bland_api_key ? ['bland' as const] : []),
    ];

    return (
        <div className="flex flex-col h-full">
            <Header
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Agents</h2>
                    {canCreate && (
                        <CreateAgentButton
                            clients={clients}
                            phoneNumbers={phoneNumbers.map(pn => ({ ...pn, agent_id: pn.agent_id ?? undefined }))}
                            availableProviders={availableProviders}
                            basePath="/portal"
                        />
                    )}
                </div>

                <FilterableAgentGrid
                    agents={(agents || []) as (Agent & { clients: { name: string } | null })[]}
                    agentPhoneMap={agentPhoneMap}
                    configBasePath="/portal/agents"
                />
            </div>
        </div>
    );
}
