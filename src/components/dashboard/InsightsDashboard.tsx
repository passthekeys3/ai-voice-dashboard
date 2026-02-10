'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Phone,
    Clock,
    Smile,
    Frown,
    Meh,
    Target,
    MessageSquare,
    AlertTriangle,
    Trophy,
    Loader2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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

export function InsightsDashboard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<InsightsData | null>(null);
    const [days, setDays] = useState('30');

    useEffect(() => {
        async function fetchInsights() {
            setLoading(true);
            try {
                const response = await fetch(`/api/insights?days=${days}`);
                const result = await response.json();
                setData(result.data);
            } catch (err) {
                console.error('Failed to fetch insights:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchInsights();
    }, [days]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    No data available
                </CardContent>
            </Card>
        );
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6">
            {/* Time Filter */}
            <div className="flex justify-end">
                <Select value={days} onValueChange={setDays}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total Calls</span>
                        </div>
                        <div className="text-3xl font-bold mt-2">{data.totalCalls.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Avg Duration</span>
                        </div>
                        <div className="text-3xl font-bold mt-2">{formatDuration(data.avgDuration)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Smile className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">Positive Sentiment</span>
                        </div>
                        <div className="text-3xl font-bold mt-2 text-green-600">{data.sentimentBreakdown.positive}%</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Avg Call Score</span>
                        </div>
                        <div className={`text-3xl font-bold mt-2 ${
                            data.avgCallScore >= 70 ? 'text-green-600 dark:text-green-400'
                            : data.avgCallScore >= 40 ? 'text-amber-600 dark:text-amber-400'
                            : data.avgCallScore > 0 ? 'text-red-600 dark:text-red-400'
                            : ''
                        }`}>
                            {data.avgCallScore > 0 ? `${data.avgCallScore}/100` : '-'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Sentiment Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Sentiment Breakdown</CardTitle>
                        <CardDescription>Overall call sentiment distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Smile className="h-4 w-4 text-green-500" />
                                    <span className="text-sm">Positive</span>
                                </div>
                                <span className="font-medium">{data.sentimentBreakdown.positive}%</span>
                            </div>
                            <Progress value={data.sentimentBreakdown.positive} className="h-2 bg-gray-200" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Meh className="h-4 w-4 text-yellow-500" />
                                    <span className="text-sm">Neutral</span>
                                </div>
                                <span className="font-medium">{data.sentimentBreakdown.neutral}%</span>
                            </div>
                            <Progress value={data.sentimentBreakdown.neutral} className="h-2 bg-gray-200" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Frown className="h-4 w-4 text-red-500" />
                                    <span className="text-sm">Negative</span>
                                </div>
                                <span className="font-medium">{data.sentimentBreakdown.negative}%</span>
                            </div>
                            <Progress value={data.sentimentBreakdown.negative} className="h-2 bg-gray-200" />
                        </div>
                    </CardContent>
                </Card>

                {/* Sentiment Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Sentiment Trend</CardTitle>
                        <CardDescription>Daily sentiment over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.sentimentTrend.length > 0 ? (
                            <div className="space-y-2">
                                {data.sentimentTrend.slice(-7).map((day) => (
                                    <div key={day.date} className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground w-20">
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                        <div className="flex-1 flex h-4 rounded overflow-hidden">
                                            <div
                                                className="bg-green-500"
                                                style={{ width: `${day.positive}%` }}
                                                title={`Positive: ${day.positive}%`}
                                            />
                                            <div
                                                className="bg-yellow-400"
                                                style={{ width: `${day.neutral}%` }}
                                                title={`Neutral: ${day.neutral}%`}
                                            />
                                            <div
                                                className="bg-red-500"
                                                style={{ width: `${day.negative}%` }}
                                                title={`Negative: ${day.negative}%`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No trend data available
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Top Topics */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MessageSquare className="h-5 w-5" />
                            Top Topics
                        </CardTitle>
                        <CardDescription>Most discussed topics in calls</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.topTopics.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {data.topTopics.map((t, i) => (
                                    <Badge
                                        key={t.topic}
                                        variant={i === 0 ? 'default' : 'secondary'}
                                        className="text-sm"
                                    >
                                        {t.topic}
                                        <span className="ml-1 opacity-60">({t.count})</span>
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No topics extracted yet. Topics are extracted from call transcripts.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Top Objections */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="h-5 w-5" />
                            Common Objections
                        </CardTitle>
                        <CardDescription>Frequent customer pushbacks</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.topObjections.length > 0 ? (
                            <div className="space-y-2">
                                {data.topObjections.slice(0, 5).map((obj) => (
                                    <div key={obj.objection} className="flex items-center justify-between">
                                        <span className="text-sm">{obj.objection}</span>
                                        <Badge variant="outline">{obj.count}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No objections tracked yet.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Agent Leaderboard */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Agent Leaderboard
                    </CardTitle>
                    <CardDescription>Performance ranking by sentiment and calls</CardDescription>
                </CardHeader>
                <CardContent>
                    {data.agentPerformance.length > 0 ? (
                        <div className="space-y-4">
                            {data.agentPerformance.map((agent, index) => (
                                <div key={agent.agent_id} className="flex items-center gap-4">
                                    <div className="w-8 text-center">
                                        {index === 0 && <span className="text-2xl">🥇</span>}
                                        {index === 1 && <span className="text-2xl">🥈</span>}
                                        {index === 2 && <span className="text-2xl">🥉</span>}
                                        {index > 2 && <span className="text-lg text-muted-foreground font-medium">{index + 1}</span>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{agent.agent_name}</span>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span>{agent.call_count} calls</span>
                                                <span>{formatDuration(agent.avg_duration)} avg</span>
                                                <span className="text-green-600 font-medium">{agent.avg_sentiment}% positive</span>
                                                {agent.avg_conversion > 0 && (
                                                    <span className="font-medium">Score: {agent.avg_conversion}</span>
                                                )}
                                            </div>
                                        </div>
                                        <Progress value={agent.avg_sentiment} className="h-2 mt-2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No agent data available
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
