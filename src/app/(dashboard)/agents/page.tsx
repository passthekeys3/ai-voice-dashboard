import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { FilterableAgentGrid } from '@/components/dashboard/FilterableAgentGrid';
import { SyncButton } from '@/components/dashboard/SyncButton';
import { CreateAgentButton } from '@/components/dashboard/CreateAgentButton';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { Agent } from '@/types';

export const metadata: Metadata = { title: 'Agents' };

export default async function AgentsPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const isAdmin = isAgencyAdmin(user);

    let query = supabase
        .from('agents')
        .select('*, clients(name)')
        .eq('agency_id', user.agency.id)
        .order('created_at', { ascending: false });

    if (!isAdmin && user.client) {
        query = query.eq('client_id', user.client.id);
    }

    const { data: agents } = await query;

    // Fetch phone numbers to show which number is assigned to which agent
    const { data: phoneNumbers } = await supabase
        .from('phone_numbers')
        .select('id, phone_number, agent_id')
        .eq('agency_id', user.agency.id)
        .eq('status', 'active');

    // Create a map of agent_id -> phone_number
    const agentPhoneMap: Record<string, string> = {};
    phoneNumbers?.forEach(pn => {
        if (pn.agent_id) {
            agentPhoneMap[pn.agent_id] = pn.phone_number;
        }
    });

    // Fetch clients for agent creation
    const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', user.agency.id)
        .order('name');

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Agents"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Agents</h2>
                        <p className="text-muted-foreground">
                            Manage your voice AI agents
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                            <SyncButton />
                            <Link
                                href="/agent-builder"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 transition-all shadow-sm"
                            >
                                <Sparkles className="h-4 w-4" />
                                Build with AI
                            </Link>
                            <CreateAgentButton
                                clients={clients || []}
                                phoneNumbers={phoneNumbers || []}
                            />
                        </div>
                    )}
                </div>

                <FilterableAgentGrid
                    agents={(agents || []) as (Agent & { clients: { name: string } | null })[]}
                    agentPhoneMap={agentPhoneMap}
                />
            </div>
        </div>
    );
}
