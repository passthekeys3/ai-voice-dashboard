import type { Metadata } from 'next';

import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { BillingUsage } from '@/components/dashboard/BillingUsage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getUserPermissions } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Billing' };

export default async function ClientBillingPage() {
    const user = await requireAuth();
    const permissions = getUserPermissions(user);

    // Redirect if client user doesn't have costs permission
    if (!permissions.show_costs) {
        redirect('/portal');
    }

    const supabase = createServiceClient();

    // Get current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get agents scoped to client
    const clientId = user.client?.id;

    let agentQuery = supabase
        .from('agents')
        .select('id')
        .eq('agency_id', user.agency.id);

    if (clientId) {
        agentQuery = agentQuery.eq('client_id', clientId);
    }

    const { data: agents } = await agentQuery;
    const agentIds = agents?.map(a => a.id) || [];

    // Get calls for this month
    let calls: { duration_seconds: number; cost_cents: number }[] = [];
    if (agentIds.length > 0) {
        const { data: callData } = await supabase
            .from('calls')
            .select('duration_seconds, cost_cents')
            .in('agent_id', agentIds)
            .gte('started_at', startOfMonth.toISOString())
            .lte('started_at', endOfMonth.toISOString());
        calls = callData || [];
    }

    const totalCalls = calls.length;
    const totalSeconds = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60 * 100) / 100;
    const totalCostCents = calls.reduce((sum, c) => sum + (c.cost_cents || 0), 0);
    const totalCost = totalCostCents / 100;

    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Billing"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
                    <p className="text-muted-foreground">
                        View your usage and costs
                    </p>
                </div>

                {/* Current Period Usage */}
                <Card>
                    <CardHeader>
                        <CardTitle>Current Period</CardTitle>
                        <CardDescription>{monthName}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Calls</p>
                                <p className="text-3xl font-bold">{totalCalls}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Minutes</p>
                                <p className="text-3xl font-bold">{totalMinutes}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Cost (Provider)</p>
                                <p className="text-3xl font-bold">${totalCost.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Method Management */}
                <BillingUsage />
            </div>
        </div>
    );
}
