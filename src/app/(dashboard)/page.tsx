import type { Metadata } from 'next';

import { redirect } from 'next/navigation';
import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { AnalyticsCards } from '@/components/dashboard/AnalyticsCards';
import { UsageChart } from '@/components/dashboard/UsageChart';
import { CallsTable } from '@/components/dashboard/CallsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserPermissions } from '@/lib/permissions';
import type { Call } from '@/types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);

    // Redirect new agency admins to onboarding if no API keys configured
    if (isAdmin && process.env.DEMO_MODE !== 'true') {
        const hasApiKey = user.agency.retell_api_key || user.agency.vapi_api_key;
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

    // Calculate stats from actual calls in database
    let statsQuery = supabase
        .from('calls')
        .select('duration_seconds, cost_cents, status, started_at');

    if (agentIds.length > 0) {
        statsQuery = statsQuery.in('agent_id', agentIds);
    }

    if (clientId) {
        statsQuery = statsQuery.eq('client_id', clientId);
    }

    const { data: callStats } = await statsQuery;

    const totalCalls = callStats?.length || 0;
    const totalMinutes = Math.round((callStats?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60);
    const totalCost = (callStats?.reduce((sum, c) => sum + (c.cost_cents || 0), 0) || 0) / 100;
    const completedCalls = callStats?.filter(c => c.status === 'completed').length || 0;
    const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

    // Calculate call volume data for chart (last 30 days)
    const volumeMap = new Map<string, number>();
    const now = new Date();

    // Initialize last 30 days with 0
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        volumeMap.set(dateStr, 0);
    }

    // Count calls per day
    callStats?.forEach(call => {
        if (call.started_at) {
            const dateStr = call.started_at.split('T')[0];
            if (volumeMap.has(dateStr)) {
                volumeMap.set(dateStr, (volumeMap.get(dateStr) || 0) + 1);
            }
        }
    });

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
                />

                {/* Charts */}
                <div className="grid gap-4 md:grid-cols-7 overflow-hidden">
                    <UsageChart data={callVolumeData} />

                    <Card className="md:col-span-3">
                        <CardHeader>
                            <CardTitle>Your Agents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {agents && agents.length > 0 ? (
                                    agents.map((agent) => (
                                        <div key={agent.id} className="flex items-center justify-between">
                                            <span className="font-medium truncate">{agent.name}</span>
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

