'use client';

import { useState, useMemo } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Bot, Phone } from 'lucide-react';
import Link from 'next/link';
import { CreateClientDialog } from '@/components/dashboard/CreateClientDialog';
import { cn } from '@/lib/utils';

interface ClientWithSummary {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
    created_at: string;
    agents: { id: string; provider: string }[];
    calls: { count: number }[];
}

interface FilterableClientGridProps {
    clients: ClientWithSummary[];
}

const providerDotColor: Record<string, string> = {
    retell: 'bg-blue-500',
    vapi: 'bg-purple-500',
    bland: 'bg-amber-500',
};

export function FilterableClientGrid({ clients }: FilterableClientGridProps) {
    const [search, setSearch] = useState('');

    const filteredClients = useMemo(() => {
        if (!search) return clients;
        const q = search.toLowerCase();
        return clients.filter(client =>
            client.name.toLowerCase().includes(q) ||
            client.email?.toLowerCase().includes(q) ||
            client.agents?.some(a => a.provider.toLowerCase().includes(q))
        );
    }, [clients, search]);

    if (clients.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No clients yet</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-6">
                        Add your first business client to manage their voice AI agents.
                    </p>
                    <CreateClientDialog />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <SearchInput
                placeholder="Search clients by name, email, or provider..."
                value={search}
                onChange={setSearch}
                className="max-w-sm"
            />

            {filteredClients.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredClients.map((client) => {
                        const agentCount = client.agents?.length || 0;
                        const uniqueProviders = [...new Set(client.agents?.map(a => a.provider) || [])];
                        const callCount = client.calls?.[0]?.count || 0;

                        return (
                            <Link
                                key={client.id}
                                href={`/clients/${client.id}`}
                                className="block"
                            >
                                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                                <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <CardTitle className="text-lg truncate">{client.name}</CardTitle>
                                                <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                                            </div>
                                        </div>
                                        <Badge variant={client.is_active ? 'default' : 'secondary'} className="shrink-0">
                                            {client.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Bot className="h-3.5 w-3.5" />
                                                    <span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
                                                    {uniqueProviders.length > 0 && (
                                                        <div className="flex gap-1 ml-0.5">
                                                            {uniqueProviders.map(p => (
                                                                <span
                                                                    key={p}
                                                                    className={cn(
                                                                        'inline-block h-2 w-2 rounded-full',
                                                                        providerDotColor[p] || 'bg-gray-400 dark:bg-gray-500'
                                                                    )}
                                                                    title={p.charAt(0).toUpperCase() + p.slice(1)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-border">·</span>
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="h-3.5 w-3.5" />
                                                    <span>{callCount.toLocaleString()} call{callCount !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm text-muted-foreground hover:text-foreground">
                                                View Details &rarr;
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-muted-foreground">
                        No clients matching &quot;{search}&quot;
                    </p>
                </div>
            )}
        </div>
    );
}
