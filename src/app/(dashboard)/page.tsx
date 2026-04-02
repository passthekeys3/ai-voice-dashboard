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
        const hasApiKey = user.agency.retell_api_key || user.agency.vapi_api_key || user.agency.bland_api_key || user.agency.elevenlabs_api_key;
        if (!hasApiKey) {
            redirect('/onboarding');
        }
    }

    const clientId = !isAdmin && user.client ? user.client.id : undefined;

    // Get agent IDs for this agency
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name, provider')
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
    // Extend to end of today UTC to ensure today's calls are included
    now.setUTCHours(23, 59, 59, 999);

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

    // Use agency's calling window timezone, or default to America/New_York
    const userTimezone = user.agency.calling_window?.timezone_override || 'America/New_York';

    const { data: volumeRows } = await supabase.rpc('get_call_volume_by_day', {
        p_agent_ids: agentIds,
        p_since: thirtyDaysAgo.toISOString(),
        p_until: now.toISOString(),
        ...(clientId ? { p_client_id: clientId } : {}),
        p_timezone: userTimezone,
    });

    // Fill in missing days with 0, using the user's timezone for date strings
    const toLocaleDateStr = (d: Date) => {
        const year = d.toLocaleString('en-CA', { timeZone: userTimezone, year: 'numeric' });
        const month = d.toLocaleString('en-CA', { timeZone: userTimezone, month: '2-digit' });
        const day = d.toLocaleString('en-CA', { timeZone: userTimezone, day: '2-digit' });
        return `${year}-${month}-${day}`;
    };
    const volumeMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        volumeMap.set(toLocaleDateStr(date), 0);
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

            <div className="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* KPI Cards */}
                <p className="text-xs text-muted-foreground">Last 90 days</p>
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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base">Agents</CardTitle>
                                {agents && agents.length > 0 && (
                                    <span className="text-xs text-muted-foreground">{agents.length}</span>
                                )}
                            </div>
                            {agents && agents.length > 0 && (
                                <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    View all &rarr;
                                </Link>
                            )}
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                {agents && agents.length > 0 ? (
                                    agents.map((agent) => (
                                        <Link
                                            key={agent.id}
                                            href={`/agents/${agent.id}`}
                                            className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md text-sm hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none transition-colors"
                                        >
                                            <span className="font-medium truncate">{agent.name}</span>
                                            <span className="text-[11px] font-medium text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded shrink-0 ml-2">{agent.provider}</span>
                                        </Link>
                                    ))
                                ) : (
                                    <p className="text-muted-foreground text-sm py-4">
                                        No agents yet. Add your API keys in <Link href="/settings" className="underline hover:text-foreground">Settings</Link>, then sync.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Calls */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">Recent Calls</h3>
                        <Link href="/calls" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            View all &rarr;
                        </Link>
                    </div>
                    <CallsTable calls={(recentCalls || []) as (Call & { agents: { name: string; provider: string } })[]} />
                </div>
            </div>
        </div>
    );
}

