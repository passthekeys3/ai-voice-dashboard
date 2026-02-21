'use client';

import { useState, useMemo } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { CreateClientDialog } from '@/components/dashboard/CreateClientDialog';
import type { Client } from '@/types';

interface FilterableClientGridProps {
    clients: Client[];
}

export function FilterableClientGrid({ clients }: FilterableClientGridProps) {
    const [search, setSearch] = useState('');

    const filteredClients = useMemo(() => {
        if (!search) return clients;
        const q = search.toLowerCase();
        return clients.filter(client =>
            client.name.toLowerCase().includes(q) ||
            client.email?.toLowerCase().includes(q)
        );
    }, [clients, search]);

    if (clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No clients yet</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                    Add your first business client to manage their voice AI agents.
                </p>
                <div className="mt-4">
                    <CreateClientDialog />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SearchInput
                placeholder="Search clients by name or email..."
                value={search}
                onChange={setSearch}
                className="max-w-sm"
            />

            {filteredClients.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredClients.map((client) => (
                        <Link
                            key={client.id}
                            href={`/clients/${client.id}`}
                            className="block"
                        >
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardHeader className="flex flex-row items-start justify-between pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                            <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{client.name}</CardTitle>
                                            <p className="text-sm text-muted-foreground">{client.email}</p>
                                        </div>
                                    </div>
                                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                                        {client.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-end">
                                        <span className="text-sm text-muted-foreground hover:text-foreground">
                                            View Details &rarr;
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
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
