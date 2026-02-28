import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

interface InsightsData {
    totalCalls: number;
    avgDuration: number;
    avgConversionScore: number;
    avgCallScore: number;
    sentimentBreakdown: {
        positive: number;
        neutral: number;
        negative: number;
    };
    sentimentTrend: {
        date: string;
        positive: number;
        neutral: number;
        negative: number;
    }[];
    topTopics: { topic: string; count: number }[];
    topObjections: { objection: string; count: number }[];
    agentPerformance: {
        agent_id: string;
        agent_name: string;
        call_count: number;
        avg_duration: number;
        avg_sentiment: number;
        avg_conversion: number;
    }[];
}

// GET /api/insights - Get aggregated call insights
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        // Validate and bound days parameter (1-365)
        let days = parseInt(searchParams.get('days') || '30');
        if (isNaN(days) || days < 1) days = 1;
        if (days > 365) days = 365;
        const agentId = searchParams.get('agent_id');

        // If agent_id is provided, validate it belongs to this agency
        if (agentId) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agentId)
                .eq('agency_id', user.agency.id)
                .single();

            if (!agent) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
        }

        // Call the database RPC function for all aggregation
        // This replaces in-memory processing of up to 50K rows with a single SQL query
        const { data, error } = await supabase.rpc('get_insights', {
            p_agency_id: user.agency.id,
            p_days: days,
            p_agent_id: agentId || null,
            p_client_id: user.client?.id || null,
        });

        if (error) {
            console.error('Error fetching insights:', error.code);
            return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
        }

        // If no data returned (e.g. no calls in range), return empty structure
        if (!data || (typeof data === 'object' && data.totalCalls === 0)) {
            const emptyData: InsightsData = {
                totalCalls: 0,
                avgDuration: 0,
                avgConversionScore: 0,
                avgCallScore: 0,
                sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
                sentimentTrend: [],
                topTopics: [],
                topObjections: [],
                agentPerformance: [],
            };
            return NextResponse.json({ data: emptyData });
        }

        return NextResponse.json({ data: data as InsightsData });
    } catch (error) {
        console.error('Error fetching insights:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
