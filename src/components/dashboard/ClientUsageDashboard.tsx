'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Phone, Clock, DollarSign, TrendingUp, Loader2 } from 'lucide-react';

interface UsageData {
    usage: {
        total_calls: number;
        total_minutes: number;
        total_cost_cents: number;
    };
    billingRate: number;
    period: {
        start: string;
        end: string;
        label: string;
    };
}

interface ClientUsageDashboardProps {
    clientId: string;
}

export function ClientUsageDashboard({ clientId }: ClientUsageDashboardProps) {
    const [data, setData] = useState<UsageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchUsage() {
            try {
                const res = await fetch(`/api/clients/${clientId}/usage`);
                if (!res.ok) {
                    if (res.status === 400) return; // Not per-minute billing
                    throw new Error('Failed to fetch usage');
                }
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error('Error fetching usage:', err);
                setError('Failed to load usage data');
            } finally {
                setIsLoading(false);
            }
        }

        fetchUsage();
    }, [clientId]);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (error || !data) return null;

    const { usage, billingRate, period } = data;
    const costDollars = (usage.total_cost_cents / 100).toFixed(2);
    const rateDollars = (billingRate / 100).toFixed(2);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Usage This Period</CardTitle>
                <CardDescription>{period.label}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/50">
                            <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Calls</p>
                            <p className="text-xl font-bold">{usage.total_calls.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/50">
                            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Minutes</p>
                            <p className="text-xl font-bold">{Number(usage.total_minutes).toFixed(1)}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/50">
                            <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Estimated Cost</p>
                            <p className="text-xl font-bold">${costDollars}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/50">
                            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Per-Minute Rate</p>
                            <p className="text-xl font-bold">${rateDollars}/min</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
