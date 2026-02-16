import type { Metadata } from 'next';
import { Suspense } from 'react';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { BillingSection } from '@/components/dashboard/BillingSection';
import { StripeConnectSection } from '@/components/dashboard/StripeConnectSection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserPermissions } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Billing' };

function SectionSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-10 w-40" />
            </CardContent>
        </Card>
    );
}

export default async function BillingPage() {
    const user = await requireAuth();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);

    // Redirect if client user doesn't have costs permission
    if (!isAdmin && !permissions.show_costs) {
        redirect('/');
    }
    const supabase = createServiceClient();

    // Get current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get agents for this user
    let agentQuery = supabase
        .from('agents')
        .select('id')
        .eq('agency_id', user.agency.id);

    if (user.client) {
        agentQuery = agentQuery.eq('client_id', user.client.id);
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
                        Manage your subscription, view usage, and configure client billing
                    </p>
                </div>

                {/* Subscription Management */}
                {isAdmin && (
                    <Suspense fallback={<SectionSkeleton />}>
                        <BillingSection />
                    </Suspense>
                )}

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

                {/* Stripe Connect — Client Billing */}
                {isAdmin && (
                    <Suspense fallback={<SectionSkeleton />}>
                        <StripeConnectSection />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
