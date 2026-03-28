'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Search, ArrowRight } from 'lucide-react';
import { toast } from '@/lib/toast';

type PlanType = 'self_service' | 'managed';
type PlanTier = 'starter' | 'growth' | 'agency';
type PlanFilter = 'all' | 'managed' | 'self_service';

interface ManagedAgency {
    id: string;
    name: string;
    subscription_status: string | null;
    plan_type: PlanType;
    plan_tier: PlanTier | null;
    is_beta: boolean;
    created_at: string;
    agent_count: number;
    client_count: number;
    usage_minutes: number;
    usage_cost: number;
}

interface ManagedAccountsTableProps {
    agencies: ManagedAgency[];
}

function getStatusBadge(status: string | null) {
    if (!status) return <Badge variant="outline">None</Badge>;

    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
        active: { variant: 'default', label: 'Active' },
        trialing: { variant: 'secondary', label: 'Trial' },
        past_due: { variant: 'destructive', label: 'Past Due' },
        canceled: { variant: 'outline', label: 'Canceled' },
        expired: { variant: 'destructive', label: 'Expired' },
        unpaid: { variant: 'destructive', label: 'Unpaid' },
    };

    const statusConfig = config[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function tierLabel(tier: PlanTier | null): string {
    if (!tier) return '—';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
}

const FILTER_OPTIONS: { value: PlanFilter; label: string }[] = [
    { value: 'managed', label: 'Managed' },
    { value: 'all', label: 'All' },
    { value: 'self_service', label: 'Self-service' },
];

export function ManagedAccountsTable({ agencies }: ManagedAccountsTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [planFilter, setPlanFilter] = useState<PlanFilter>('managed');
    // Local plan_type overrides for optimistic UI updates
    const [planOverrides, setPlanOverrides] = useState<Record<string, PlanType>>({});
    // Confirmation dialog state
    const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; from: PlanType; to: PlanType } | null>(null);

    const getEffectivePlanType = (agency: ManagedAgency): PlanType =>
        planOverrides[agency.id] ?? agency.plan_type;

    const filtered = agencies.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
        const effectivePlan = getEffectivePlanType(a);
        const matchesFilter = planFilter === 'all' || effectivePlan === planFilter;
        return matchesSearch && matchesFilter;
    });

    const managedCount = agencies.filter(a => getEffectivePlanType(a) === 'managed').length;

    const handleManage = async (agencyId: string) => {
        setLoadingId(agencyId);
        try {
            const res = await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agency_id: agencyId }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error('Failed to start impersonation', { description: data.error });
                setLoadingId(null);
                return;
            }

            router.push('/');
            router.refresh();
        } catch {
            toast.error('Failed to start impersonation');
            setLoadingId(null);
        }
    };

    const handleTogglePlan = async (agencyId: string, currentPlan: PlanType) => {
        const newPlan: PlanType = currentPlan === 'managed' ? 'self_service' : 'managed';
        setTogglingId(agencyId);

        // Optimistic update
        setPlanOverrides(prev => ({ ...prev, [agencyId]: newPlan }));

        try {
            const res = await fetch(`/api/admin/agencies/${agencyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_type: newPlan }),
            });

            if (!res.ok) {
                // Revert optimistic update
                setPlanOverrides(prev => ({ ...prev, [agencyId]: currentPlan }));
                toast.error('Failed to update plan type');
            } else {
                toast.success(`Switched to ${newPlan === 'managed' ? 'Managed' : 'Self-service'}`);
            }
        } catch {
            setPlanOverrides(prev => ({ ...prev, [agencyId]: currentPlan }));
            toast.error('Failed to update plan type');
        } finally {
            setTogglingId(null);
        }
    };

    const requestToggle = (agency: ManagedAgency) => {
        const effectivePlan = getEffectivePlanType(agency);
        const newPlan: PlanType = effectivePlan === 'managed' ? 'self_service' : 'managed';
        setConfirmToggle({ id: agency.id, name: agency.name, from: effectivePlan, to: newPlan });
    };

    const confirmAndToggle = () => {
        if (!confirmToggle) return;
        handleTogglePlan(confirmToggle.id, confirmToggle.from);
        setConfirmToggle(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Managed Accounts</CardTitle>
                            <CardDescription>
                                Click &quot;Manage&quot; to access an agency&apos;s dashboard. Toggle plan type to mark agencies as managed.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary">{managedCount} managed / {agencies.length} total</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search + Filter */}
                    <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search agencies..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex rounded-md border overflow-hidden">
                            {FILTER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPlanFilter(opt.value)}
                                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                                        planFilter === opt.value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-muted'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    {filtered.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            {search || planFilter !== 'all'
                                ? 'No agencies match your filters.'
                                : 'No agencies found.'}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agency</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Tier</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Agents</TableHead>
                                        <TableHead className="text-center">Clients</TableHead>
                                        <TableHead className="text-right">This Month</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((agency) => {
                                        const effectivePlan = getEffectivePlanType(agency);
                                        return (
                                            <TableRow key={agency.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{agency.name}</span>
                                                        {agency.is_beta && (
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                                                                Beta
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        onClick={() => requestToggle(agency)}
                                                        disabled={togglingId === agency.id}
                                                        className="cursor-pointer"
                                                        title={`Click to switch to ${effectivePlan === 'managed' ? 'self-service' : 'managed'}`}
                                                    >
                                                        <Badge
                                                            variant={effectivePlan === 'managed' ? 'default' : 'outline'}
                                                            className={effectivePlan === 'managed'
                                                                ? 'bg-purple-600 hover:bg-purple-700'
                                                                : 'hover:bg-muted'}
                                                        >
                                                            {togglingId === agency.id
                                                                ? '...'
                                                                : effectivePlan === 'managed' ? 'Managed' : 'Self-service'}
                                                        </Badge>
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {tierLabel(agency.plan_tier)}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(agency.subscription_status)}</TableCell>
                                                <TableCell className="text-center">{agency.agent_count}</TableCell>
                                                <TableCell className="text-center">{agency.client_count}</TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {agency.usage_minutes > 0 ? (
                                                        <div>
                                                            <span className="font-medium">{agency.usage_minutes} min</span>
                                                            <span className="text-muted-foreground ml-1">(${agency.usage_cost.toFixed(2)})</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{formatDate(agency.created_at)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleManage(agency.id)}
                                                        disabled={loadingId === agency.id}
                                                    >
                                                        {loadingId === agency.id ? 'Loading...' : (
                                                            <>
                                                                Manage
                                                                <ArrowRight className="ml-1 h-3 w-3" />
                                                            </>
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation dialog for plan type toggle */}
            <AlertDialog open={!!confirmToggle} onOpenChange={(open: boolean) => { if (!open) setConfirmToggle(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change plan type?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Switch <strong>{confirmToggle?.name}</strong> from{' '}
                            <strong>{confirmToggle?.from === 'managed' ? 'Managed' : 'Self-service'}</strong> to{' '}
                            <strong>{confirmToggle?.to === 'managed' ? 'Managed' : 'Self-service'}</strong>?
                            {confirmToggle?.to === 'managed' && (
                                <span className="block mt-2">
                                    This will route all their calls through platform keys at $0.15/min.
                                </span>
                            )}
                            {confirmToggle?.to === 'self_service' && (
                                <span className="block mt-2">
                                    They will need their own API keys to make calls (or use platform keys at $0.15/min).
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmAndToggle}>
                            Switch to {confirmToggle?.to === 'managed' ? 'Managed' : 'Self-service'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
