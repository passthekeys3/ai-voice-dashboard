import type { Metadata } from 'next';

import { requireAuth, isAgencyAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { AnalyticsCards } from '@/components/dashboard/AnalyticsCards';
import { AnalyticsFilters } from '@/components/dashboard/AnalyticsFilters';
import { UsageChart } from '@/components/dashboard/UsageChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserPermissions } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import type { AnalyticsOverview } from '@/types';

interface Props {
    searchParams: Promise<{ days?: string; client_id?: string }>;
}

export const metadata: Metadata = { title: 'Analytics' };

export default async function AnalyticsPage({ searchParams }: Props) {
    const user = await requireAuth();
    const isAdmin = isAgencyAdmin(user);
    const permissions = getUserPermissions(user);

    // Redirect if client user doesn't have analytics permission
    if (!isAdmin && !permissions.show_analytics) {
        redirect('/');
    }

    const clientId = !isAdmin && user.client ? user.client.id : undefined;

    const params = await searchParams;
    const daysParam = params.days || '30';
    const days = daysParam === 'all' ? null : parseInt(daysParam);

    const supabase = createServiceClient();

    // Calculate date range
    const endDate = new Date();
    const startDate = days ? new Date() : null;
    if (startDate && days) {
        startDate.setDate(startDate.getDate() - days);
    }

    // Get agents for this agency
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('agency_id', user.agency.id);

    const agentIds = agents?.map(a => a.id) || [];

    let analytics: AnalyticsOverview = {
        total_calls: 0,
        total_minutes: 0,
        total_cost: 0,
        success_rate: 0,
        avg_call_duration: 0,
        calls_by_day: [],
        calls_by_agent: [],
    };

    if (agentIds.length > 0) {
        // Build query for calls
        let callsQuery = supabase
            .from('calls')
            .select('id, duration_seconds, cost_cents, status, started_at, agent_id')
            .in('agent_id', agentIds);

        if (startDate) {
            callsQuery = callsQuery.gte('started_at', startDate.toISOString());
        }
        callsQuery = callsQuery.lte('started_at', endDate.toISOString());

        if (clientId) {
            callsQuery = callsQuery.eq('client_id', clientId);
        }

        const { data: calls } = await callsQuery;

        if (calls && calls.length > 0) {
            const totalCalls = calls.length;
            const completedCalls = calls.filter(c => c.status === 'completed').length;
            const totalMinutes = calls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0) / 60;
            const totalCost = calls.reduce((acc, c) => acc + (c.cost_cents || 0), 0) / 100;
            const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
            const avgCallDuration = totalCalls > 0 ? totalMinutes / totalCalls : 0;

            // Group calls by day
            const callsByDay: Record<string, number> = {};
            calls.forEach(call => {
                const date = new Date(call.started_at).toISOString().split('T')[0];
                callsByDay[date] = (callsByDay[date] || 0) + 1;
            });

            // For chart data, use actual date range or last 30 days for "all time"
            const chartDays = days || 30;
            const chartStartDate = new Date();
            chartStartDate.setDate(chartStartDate.getDate() - chartDays);

            const callsByDayArray: { date: string; count: number }[] = [];
            for (let d = new Date(chartStartDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                callsByDayArray.push({ date: dateStr, count: callsByDay[dateStr] || 0 });
            }

            // Group calls by agent
            const callsByAgent: Record<string, number> = {};
            calls.forEach(call => {
                if (call.agent_id) {
                    callsByAgent[call.agent_id] = (callsByAgent[call.agent_id] || 0) + 1;
                }
            });

            const callsByAgentArray = Object.keys(callsByAgent).map(id => ({
                agent_id: id,
                agent_name: agents?.find(a => a.id === id)?.name || 'Unknown',
                count: callsByAgent[id],
            })).sort((a, b) => b.count - a.count);

            analytics = {
                total_calls: totalCalls,
                total_minutes: Math.round(totalMinutes * 100) / 100,
                total_cost: Math.round(totalCost * 100) / 100,
                success_rate: Math.round(successRate * 100) / 100,
                avg_call_duration: Math.round(avgCallDuration * 100) / 100,
                calls_by_day: callsByDayArray,
                calls_by_agent: callsByAgentArray,
            };
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Analytics"
                userName={user.profile.full_name}
                userEmail={user.email}
                userAvatar={user.profile.avatar_url}
            />

            <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
                        <p className="text-muted-foreground">
                            Detailed performance metrics for your voice agents
                        </p>
                    </div>
                    <AnalyticsFilters />
                </div>

                {/* KPI Cards */}
                <AnalyticsCards
                    totalCalls={analytics.total_calls}
                    totalMinutes={analytics.total_minutes}
                    totalCost={analytics.total_cost}
                    successRate={analytics.success_rate}
                    showCosts={isAdmin || permissions.show_costs}
                />

                {/* Charts */}
                <div className="grid gap-4 md:grid-cols-7">
                    <UsageChart data={analytics.calls_by_day} />

                    <Card className="md:col-span-3 min-w-0">
                        <CardHeader>
                            <CardTitle>Calls by Agent</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {analytics.calls_by_agent.length > 0 ? (
                                    analytics.calls_by_agent.map((agent) => {
                                        const percentage = analytics.total_calls > 0
                                            ? (agent.count / analytics.total_calls) * 100
                                            : 0;

                                        return (
                                            <div key={agent.agent_id} className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium truncate">{agent.agent_name}</span>
                                                    <span className="text-muted-foreground">{agent.count} calls</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                                    <div
                                                        className="h-2 rounded-full bg-blue-500"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-muted-foreground text-sm">No agent data available</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Additional metrics */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Average Call Duration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold">
                                {analytics.avg_call_duration.toFixed(1)} min
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Average duration across all completed calls
                            </p>
                        </CardContent>
                    </Card>

                    {(isAdmin || permissions.show_costs) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Cost per Call</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold">
                                    ${analytics.total_calls > 0
                                        ? (analytics.total_cost / analytics.total_calls).toFixed(2)
                                        : '0.00'}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Average cost per call
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
