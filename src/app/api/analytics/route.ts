import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');
        // Validate and bound days parameter (1-365)
        let days = parseInt(searchParams.get('days') || '30');
        if (isNaN(days) || days < 1) days = 1;
        if (days > 365) days = 365;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get agents for this agency with their names in a single query
        // This avoids the N+1 query problem by fetching agent names upfront
        // Non-admin client users only see their own client's agents
        let agentsQuery = supabase
            .from('agents')
            .select('id, name')
            .eq('agency_id', user.agency.id);

        if (!isAgencyAdmin(user) && user.profile.client_id) {
            agentsQuery = agentsQuery.eq('client_id', user.profile.client_id);
        }

        const { data: agents } = await agentsQuery;

        const agentIds = agents?.map(a => a.id) || [];
        const agentNameMap = new Map(agents?.map(a => [a.id, a.name]) || []);

        if (agentIds.length === 0) {
            return NextResponse.json({
                data: {
                    total_calls: 0,
                    total_minutes: 0,
                    total_cost: 0,
                    success_rate: 0,
                    avg_call_duration: 0,
                    calls_by_day: [],
                    calls_by_agent: [],
                },
            });
        }

        // Build base query for calls
        let callsQuery = supabase
            .from('calls')
            .select('id, duration_seconds, cost_cents, status, started_at, agent_id')
            .in('agent_id', agentIds)
            .gte('started_at', startDate.toISOString())
            .lte('started_at', endDate.toISOString());

        // Filter by client — non-admins can only filter by their own client
        if (clientId) {
            if (!isAgencyAdmin(user) && user.profile.client_id && clientId !== user.profile.client_id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            callsQuery = callsQuery.eq('client_id', clientId);
        }

        const { data: calls, error: callsError } = await callsQuery;

        if (callsError) {
            console.error('Analytics calls query error:', callsError);
            return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
        }

        // Calculate analytics
        const totalCalls = calls?.length || 0;
        const completedCalls = calls?.filter(c => c.status === 'completed').length || 0;
        const totalMinutes = calls?.reduce((acc, c) => acc + (c.duration_seconds || 0), 0) / 60 || 0;
        const totalCost = calls?.reduce((acc, c) => acc + (c.cost_cents || 0), 0) / 100 || 0;
        const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
        const avgCallDuration = totalCalls > 0 ? totalMinutes / totalCalls : 0;

        // Group calls by day
        const callsByDay: Record<string, number> = {};
        calls?.forEach(call => {
            const date = new Date(call.started_at).toISOString().split('T')[0];
            callsByDay[date] = (callsByDay[date] || 0) + 1;
        });

        // Fill in missing days
        const callsByDayArray: { date: string; count: number }[] = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            callsByDayArray.push({
                date: dateStr,
                count: callsByDay[dateStr] || 0,
            });
        }

        // Group calls by agent
        const callsByAgent: Record<string, number> = {};
        calls?.forEach(call => {
            if (call.agent_id) {
                callsByAgent[call.agent_id] = (callsByAgent[call.agent_id] || 0) + 1;
            }
        });

        // Build calls by agent array using the pre-fetched agent names (no additional query needed)
        const callAgentIds = Object.keys(callsByAgent);
        const callsByAgentArray = callAgentIds.map(id => ({
            agent_id: id,
            agent_name: agentNameMap.get(id) || 'Unknown',
            count: callsByAgent[id],
        })).sort((a, b) => b.count - a.count);

        return NextResponse.json({
            data: {
                total_calls: totalCalls,
                total_minutes: Math.round(totalMinutes * 100) / 100,
                total_cost: Math.round(totalCost * 100) / 100,
                success_rate: Math.round(successRate * 100) / 100,
                avg_call_duration: Math.round(avgCallDuration * 100) / 100,
                calls_by_day: callsByDayArray,
                calls_by_agent: callsByAgentArray,
            },
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
