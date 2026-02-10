'use client';

import { useState, useMemo } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { Plus } from 'lucide-react';
import type { Agent } from '@/types';

interface FilterableAgentGridProps {
    agents: (Agent & { clients: { name: string } | null })[];
    agentPhoneMap: Record<string, string>;
}

export function FilterableAgentGrid({ agents, agentPhoneMap }: FilterableAgentGridProps) {
    const [search, setSearch] = useState('');

    const filteredAgents = useMemo(() => {
        if (!search) return agents;
        const q = search.toLowerCase();
        return agents.filter(agent =>
            agent.name.toLowerCase().includes(q) ||
            agent.provider?.toLowerCase().includes(q) ||
            agent.clients?.name?.toLowerCase().includes(q)
        );
    }, [agents, search]);

    if (agents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No agents yet</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                    Click &quot;Sync Agents&quot; to import your voice agents from Retell, Vapi, or Bland.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SearchInput
                placeholder="Search agents by name, provider, or client..."
                value={search}
                onChange={setSearch}
                className="max-w-sm"
            />

            {filteredAgents.length > 0 ? (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAgents.map((agent) => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            phoneNumber={agentPhoneMap[agent.id]}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-muted-foreground">
                        No agents matching &quot;{search}&quot;
                    </p>
                </div>
            )}
        </div>
    );
}
