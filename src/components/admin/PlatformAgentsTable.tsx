'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Link2, Link2Off } from 'lucide-react';
import { toast } from '@/lib/toast';

interface PlatformAgent {
    external_id: string;
    name: string;
    voice_id: string;
    voice_name?: string;
    created_at: string;
    assigned_agency_id: string | null;
    assigned_agency_name: string | null;
    assigned_client_id: string | null;
}

interface Agency {
    id: string;
    name: string;
    plan_type?: string;
}

interface PlatformAgentsTableProps {
    agencies: Agency[];
}

export function PlatformAgentsTable({ agencies }: PlatformAgentsTableProps) {
    const [agents, setAgents] = useState<PlatformAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [selectedAgency, setSelectedAgency] = useState<Record<string, string>>({});

    // Sort agencies: managed first, then alphabetical
    const sortedAgencies = useMemo(() =>
        [...agencies].sort((a, b) => {
            const aManaged = a.plan_type === 'managed' ? 0 : 1;
            const bManaged = b.plan_type === 'managed' ? 0 : 1;
            if (aManaged !== bManaged) return aManaged - bManaged;
            return a.name.localeCompare(b.name);
        }),
    [agencies]);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/agents/platform');
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to fetch platform agents');
                return;
            }
            const data = await res.json();
            setAgents(data.agents);
        } catch {
            setError('Failed to fetch platform agents');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAgents(); }, [fetchAgents]);

    const handleAssign = async (externalId: string) => {
        const agencyId = selectedAgency[externalId];
        if (!agencyId) return;

        setAssigningId(externalId);
        try {
            const res = await fetch('/api/admin/agents/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_id: externalId, agency_id: agencyId }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error('Failed to assign agent', { description: data.error });
                return;
            }

            toast.success('Agent assigned');
            await fetchAgents();
        } catch {
            toast.error('Failed to assign agent');
        } finally {
            setAssigningId(null);
        }
    };

    const handleUnassign = async (externalId: string, agencyId: string) => {
        setAssigningId(externalId);
        try {
            const res = await fetch('/api/admin/agents/assign', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_id: externalId, agency_id: agencyId }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error('Failed to unassign agent', { description: data.error });
                return;
            }

            toast.success('Agent unassigned');
            await fetchAgents();
        } catch {
            toast.error('Failed to unassign agent');
        } finally {
            setAssigningId(null);
        }
    };

    const assignedCount = agents.filter(a => a.assigned_agency_id).length;

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading platform agents...</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-sm text-destructive">{error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Platform Retell Agents</CardTitle>
                        <CardDescription>
                            Agents on the platform Retell account. Assign them to agencies so they appear in their dashboard.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">{assignedCount} assigned / {agents.length} total</Badge>
                </div>
            </CardHeader>
            <CardContent>
                {agents.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                        No agents found on the platform Retell account.
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Voice</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Assign To</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agents.map((agent) => (
                                    <TableRow key={agent.external_id}>
                                        <TableCell className="font-medium">{agent.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {agent.voice_name || (
                                                <span className="text-xs font-mono">{agent.voice_id}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {agent.assigned_agency_id ? (
                                                <Badge variant="default" className="bg-green-600">
                                                    {agent.assigned_agency_name}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Unassigned</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {!agent.assigned_agency_id && (
                                                <Select
                                                    value={selectedAgency[agent.external_id] || ''}
                                                    onValueChange={(val: string) =>
                                                        setSelectedAgency(prev => ({ ...prev, [agent.external_id]: val }))
                                                    }
                                                >
                                                    <SelectTrigger className="w-48">
                                                        <SelectValue placeholder="Select agency" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {sortedAgencies.map((a) => (
                                                            <SelectItem key={a.id} value={a.id}>
                                                                {a.name}
                                                                {a.plan_type === 'managed' ? ' ●' : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {agent.assigned_agency_id ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleUnassign(agent.external_id, agent.assigned_agency_id!)}
                                                    disabled={assigningId === agent.external_id}
                                                >
                                                    {assigningId === agent.external_id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Link2Off className="mr-1 h-3 w-3" />
                                                            Unassign
                                                        </>
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAssign(agent.external_id)}
                                                    disabled={assigningId === agent.external_id || !selectedAgency[agent.external_id]}
                                                >
                                                    {assigningId === agent.external_id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Link2 className="mr-1 h-3 w-3" />
                                                            Assign
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
