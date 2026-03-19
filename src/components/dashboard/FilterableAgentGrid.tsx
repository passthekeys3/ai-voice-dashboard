'use client';

import { useState, useMemo } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import type { Agent } from '@/types';

interface FilterableAgentGridProps {
    agents: (Agent & { clients: { name: string } | null })[];
    agentPhoneMap: Record<string, string>;
    /** Base path for agent configure links (default: "/agents") */
    configBasePath?: string;
}

export function FilterableAgentGrid({ agents, agentPhoneMap, configBasePath }: FilterableAgentGridProps) {
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
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <Plus className="h-8 w-8 text-muted-foreground/40 mb-3" />
                    <h3 className="text-lg font-medium mb-1">No agents yet</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                        Sync your agents from Retell, Vapi, or Bland — or build one from scratch with the AI Agent Builder.
                    </p>
                    <div className="flex gap-2">
                        <a href="/agent-builder" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                            Build with AI
                        </a>
                    </div>
                </CardContent>
            </Card>
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
                            configBasePath={configBasePath}
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
