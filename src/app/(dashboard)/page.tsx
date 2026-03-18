import type { Metadata } from 'next';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { AnalyticsCards } from '@/components/dashboard/AnalyticsCards';
import { UsageChart } from '@/components/dashboard/UsageChartLazy';
import { CallsTable } from '@/components/dashboard/CallsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserPermissions } from '@/lib/permissions';
import type { Call } from '@/types';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);

    // Redirect new agency admins to onboarding if no API keys configured
    if (isAdmin) {
        const hasApiKey = user.agency.retell_api_key || user.agency.vapi_api_key || user.agency.bland_api_key;
        if (!hasApiKey) {
            redirect('/onboarding');
        }
    }

    const clientId = !isAdmin && user.client ? user.client.id : undefined;

    // Get agent IDs for this agency
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id);

    const agentIds = agents?.map(a => a.id) || [];

    // Get recent calls
    let callsQuery = supabase
        .from('calls')
        .select('*, agents(name, provider)')
        .order('started_at', { ascending: false })
        .limit(5);

    if (agentIds.length > 0) {
        callsQuery = callsQuery.in('agent_id', agentIds);
    }

    if (clientId) {
        callsQuery = callsQuery.eq('client_id', clientId);
    }

    const { data: recentCalls } = await callsQuery;

    // Aggregate stats via Postgres RPC (avoids loading all rows into memory)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const now = new Date();

    const { data: statsRow } = await supabase.rpc('get_dashboard_stats', {
        p_agent_ids: agentIds,
        p_since: ninetyDaysAgo.toISOString(),
        ...(clientId ? { p_client_id: clientId } : {}),
    });

    const stats = Array.isArray(statsRow) ? statsRow[0] : statsRow;
    const totalCalls = Number(stats?.total_calls || 0);
    const totalMinutes = Math.round(Number(stats?.total_seconds || 0) / 60);
    const totalCost = Number(stats?.total_cost_cents || 0) / 100;
    const completedCalls = Number(stats?.completed_calls || 0);
    const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

    // Call volume by day via Postgres RPC (returns only date+count rows, not full call records)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: volumeRows } = await supabase.rpc('get_call_volume_by_day', {
        p_agent_ids: agentIds,
        p_since: thirtyDaysAgo.toISOString(),
        p_until: now.toISOString(),
        ...(clientId ? { p_client_id: clientId } : {}),
    });

    // Fill in missing days with 0
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];
    const volumeMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        volumeMap.set(toDateStr(date), 0);
    }
    if (Array.isArray(volumeRows)) {
        for (const row of volumeRows) {
            const dateStr = String(row.call_date);
            if (volumeMap.has(dateStr)) {
                volumeMap.set(dateStr, Number(row.call_count));
            }
        }
    }

    const callVolumeData = Array.from(volumeMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className="flex flex-col h-full">
            <Header
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-6 sm:space-y-8">
                <div className="animate-fade-up">
                    <h2 className="text-2xl font-bold tracking-tight">
                        Welcome back, {user.profile.full_name?.split(' ')[0] || 'there'}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Here&apos;s an overview of your voice AI performance
                    </p>
                </div>

                {/* KPI Cards */}
                <AnalyticsCards
                    totalCalls={totalCalls}
                    totalMinutes={totalMinutes}
                    totalCost={totalCost}
                    successRate={successRate}
                    showCosts={permissions.show_costs}
                    links={{
                        totalCalls: '/calls',
                        totalMinutes: '/analytics',
                        totalCost: '/billing',
                        successRate: '/analytics',
                    }}
                />

                {/* Charts */}
                <div className="grid gap-4 md:grid-cols-7">
                    <UsageChart data={callVolumeData} />

                    <Card className="md:col-span-3 min-w-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div className="flex items-center gap-2">
                                <CardTitle>Your Agents</CardTitle>
                                {agents && agents.length > 0 && (
                                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                        {agents.length}
                                    </span>
                                )}
                            </div>
                            {agents && agents.length > 0 && (
                                <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    View all &rarr;
                                </Link>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {agents && agents.length > 0 ? (
                                    agents.map((agent) => (
                                        <div key={agent.id} className="flex items-center justify-between">
                                            <Link
                                                href={`/agents/${agent.id}`}
                                                className="text-sm font-medium truncate hover:underline"
                                            >
                                                {agent.name}
                                            </Link>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No agents yet. Go to Settings to add your API keys, then sync agents.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Calls */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Calls</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CallsTable calls={(recentCalls || []) as (Call & { agents: { name: string; provider: string } })[]} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

