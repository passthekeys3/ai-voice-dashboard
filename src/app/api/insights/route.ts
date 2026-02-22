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

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

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

        // Build base query
        let callsQuery = supabase
            .from('calls')
            .select('*, agent:agents!inner(name, agency_id)')
            .eq('agent.agency_id', user.agency.id)
            .gte('started_at', startDate.toISOString());

        if (agentId) {
            callsQuery = callsQuery.eq('agent_id', agentId);
        }

        // If user is client role, filter to their calls
        if (user.client) {
            callsQuery = callsQuery.eq('client_id', user.client.id);
        }

        const { data: calls, error } = await callsQuery;

        if (error) {
            console.error('Error fetching calls for insights:', error.code);
            return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
        }

        if (!calls || calls.length === 0) {
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

        // Calculate metrics
        const totalCalls = calls.length;
        const avgDuration = Math.round(
            calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / totalCalls
        );

        const callsWithScore = calls.filter(c => c.conversion_score != null);
        const avgConversionScore = callsWithScore.length > 0
            ? Math.round(callsWithScore.reduce((sum, c) => sum + (c.conversion_score || 0), 0) / callsWithScore.length)
            : 0;

        const callsWithCallScore = calls.filter((c: Record<string, unknown>) => c.call_score != null);
        const avgCallScore = callsWithCallScore.length > 0
            ? Math.round(callsWithCallScore.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.call_score as number) || 0), 0) / callsWithCallScore.length)
            : 0;

        // Sentiment breakdown - only count calls that have sentiment data
        const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
        const callsWithSentiment = calls.filter(c => c.sentiment);
        callsWithSentiment.forEach(c => {
            const sentiment = (c.sentiment || '').toLowerCase();
            if (sentiment.includes('positive')) sentimentCounts.positive++;
            else if (sentiment.includes('negative')) sentimentCounts.negative++;
            else sentimentCounts.neutral++;
        });

        const sentimentTotal = callsWithSentiment.length || 1; // avoid division by zero
        const sentimentBreakdown = {
            positive: Math.round((sentimentCounts.positive / sentimentTotal) * 100),
            neutral: Math.round((sentimentCounts.neutral / sentimentTotal) * 100),
            negative: Math.round((sentimentCounts.negative / sentimentTotal) * 100),
        };

        // Sentiment trend by day — only count calls with sentiment data
        const trendMap = new Map<string, { positive: number; neutral: number; negative: number; total: number }>();
        callsWithSentiment.forEach(c => {
            const date = c.started_at.split('T')[0];
            if (!trendMap.has(date)) {
                trendMap.set(date, { positive: 0, neutral: 0, negative: 0, total: 0 });
            }
            const entry = trendMap.get(date)!;
            entry.total++;
            const sentiment = (c.sentiment || '').toLowerCase();
            if (sentiment.includes('positive')) entry.positive++;
            else if (sentiment.includes('negative')) entry.negative++;
            else entry.neutral++;
        });

        const sentimentTrend = Array.from(trendMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, counts]) => ({
                date,
                positive: Math.round((counts.positive / counts.total) * 100),
                neutral: Math.round((counts.neutral / counts.total) * 100),
                negative: Math.round((counts.negative / counts.total) * 100),
            }));

        // Top topics
        const topicCounts = new Map<string, number>();
        calls.forEach(c => {
            if (c.topics && Array.isArray(c.topics)) {
                c.topics.forEach((topic: string) => {
                    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
                });
            }
        });
        const topTopics = Array.from(topicCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([topic, count]) => ({ topic, count }));

        // Top objections
        const objectionCounts = new Map<string, number>();
        calls.forEach(c => {
            if (c.objections && Array.isArray(c.objections)) {
                c.objections.forEach((objection: string) => {
                    objectionCounts.set(objection, (objectionCounts.get(objection) || 0) + 1);
                });
            }
        });
        const topObjections = Array.from(objectionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([objection, count]) => ({ objection, count }));

        // Agent performance
        const agentMap = new Map<string, {
            name: string;
            calls: number;
            duration: number;
            sentiment: number;
            conversion: number;
            conversionCount: number;
        }>();

        calls.forEach(c => {
            const agentId = c.agent_id;
            const agentName = c.agent?.name || 'Unknown';

            if (!agentMap.has(agentId)) {
                agentMap.set(agentId, {
                    name: agentName,
                    calls: 0,
                    duration: 0,
                    sentiment: 0,
                    conversion: 0,
                    conversionCount: 0,
                });
            }

            const agent = agentMap.get(agentId)!;
            agent.calls++;
            agent.duration += c.duration_seconds || 0;

            const sentiment = (c.sentiment || '').toLowerCase();
            if (sentiment.includes('positive')) agent.sentiment += 1;
            else if (sentiment.includes('neutral') || !sentiment.includes('negative')) agent.sentiment += 0.5;

            if (c.conversion_score != null) {
                agent.conversion += c.conversion_score;
                agent.conversionCount++;
            }
        });

        const agentPerformance = Array.from(agentMap.entries())
            .map(([agent_id, data]) => ({
                agent_id,
                agent_name: data.name,
                call_count: data.calls,
                avg_duration: Math.round(data.duration / data.calls),
                avg_sentiment: Math.round((data.sentiment / data.calls) * 100),
                avg_conversion: data.conversionCount > 0
                    ? Math.round(data.conversion / data.conversionCount)
                    : 0,
            }))
            .sort((a, b) => b.avg_sentiment - a.avg_sentiment);

        const insightsData: InsightsData = {
            totalCalls,
            avgDuration,
            avgConversionScore,
            avgCallScore,
            sentimentBreakdown,
            sentimentTrend,
            topTopics,
            topObjections,
            agentPerformance,
        };

        return NextResponse.json({ data: insightsData });
    } catch (error) {
        console.error('Error fetching insights:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
