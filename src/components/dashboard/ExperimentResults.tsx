'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Play,
    Pause,
    Trophy,
    TrendingUp,
    Clock,
    Smile,
    Phone,
    CheckCircle,
    Loader2,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { Experiment, ExperimentVariant } from '@/types';

interface ExperimentResultsProps {
    experiment: Experiment & { variants: ExperimentVariant[] };
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-500',
    running: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-blue-500',
};

export function ExperimentResults({ experiment }: ExperimentResultsProps) {
    const router = useRouter();
    const [updating, setUpdating] = useState(false);

    const variants = experiment.variants || [];
    const totalCalls = variants.reduce((sum, v) => sum + (v.call_count || 0), 0);

    // Determine leader based on goal
    const getMetricValue = (variant: ExperimentVariant) => {
        switch (experiment.goal) {
            case 'conversion': return variant.conversion_rate || 0;
            case 'duration': return variant.avg_duration || 0;
            case 'sentiment': return (variant.avg_sentiment || 0) * 100;
            default: return 0;
        }
    };

    const sortedVariants = [...variants].sort((a, b) => getMetricValue(b) - getMetricValue(a));
    const leader = sortedVariants[0];
    const maxMetricValue = Math.max(...variants.map(getMetricValue));

    const handleStatusChange = async (newStatus: 'running' | 'paused' | 'completed') => {
        setUpdating(true);
        try {
            await fetch(`/api/experiments/${experiment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    ...(newStatus === 'completed' && leader ? { winner_variant_id: leader.id } : {}),
                }),
            });
            router.refresh();
        } catch (err) {
            console.error('Failed to update experiment:', err);
        } finally {
            setUpdating(false);
        }
    };

    const handlePromoteWinner = async () => {
        if (!leader) return;

        if (!confirm(`Promote "${leader.name}" as the winner and apply its prompt to the agent?`)) {
            return;
        }

        setUpdating(true);
        try {
            // Call the promote endpoint to update agent's prompt and mark winner
            const response = await fetch(`/api/experiments/${experiment.id}/promote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    variant_id: leader.id,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to promote winner');
            }

            toast.success('Winner Promoted!', {
                description: `"${leader.name}" prompt has been applied to the agent`,
            });

            router.refresh();
        } catch (err) {
            console.error('Failed to promote winner:', err);
            toast.error('Failed to promote winner', {
                description: err instanceof Error ? err.message : 'An error occurred',
            });
        } finally {
            setUpdating(false);
        }
    };

    const goalLabels: Record<string, string> = {
        conversion: 'Conversion Rate',
        duration: 'Avg Duration',
        sentiment: 'Sentiment Score',
    };

    const goalUnits: Record<string, string> = {
        conversion: '%',
        duration: 's',
        sentiment: '%',
    };

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${statusColors[experiment.status]}`} />
                        <div>
                            <CardTitle className="text-lg">
                                {experiment.status === 'running' ? 'Experiment Running' :
                                    experiment.status === 'completed' ? 'Experiment Completed' :
                                        experiment.status === 'paused' ? 'Experiment Paused' : 'Draft'}
                            </CardTitle>
                            <CardDescription>
                                Testing {variants.length} variants • {totalCalls} calls collected
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {experiment.status === 'draft' && (
                            <Button onClick={() => handleStatusChange('running')} disabled={updating}>
                                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                Start Experiment
                            </Button>
                        )}
                        {experiment.status === 'running' && (
                            <>
                                <Button variant="outline" onClick={() => handleStatusChange('paused')} disabled={updating}>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pause
                                </Button>
                                <Button onClick={handlePromoteWinner} disabled={updating || totalCalls < 10}>
                                    <Trophy className="h-4 w-4 mr-2" />
                                    Promote Winner
                                </Button>
                            </>
                        )}
                        {experiment.status === 'paused' && (
                            <>
                                <Button onClick={() => handleStatusChange('running')} disabled={updating}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Resume
                                </Button>
                                <Button variant="outline" onClick={handlePromoteWinner} disabled={updating || totalCalls < 5}>
                                    <Trophy className="h-4 w-4 mr-2" />
                                    Promote Winner
                                </Button>
                            </>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total Calls</span>
                        </div>
                        <div className="text-2xl font-bold mt-2">{totalCalls}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Goal: {goalLabels[experiment.goal]}</span>
                        </div>
                        <div className="text-2xl font-bold mt-2">
                            {maxMetricValue.toFixed(experiment.goal === 'sentiment' ? 0 : 1)}{goalUnits[experiment.goal]}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Current Leader</span>
                        </div>
                        <div className="text-2xl font-bold mt-2">{leader?.name || '-'}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Variants</span>
                        </div>
                        <div className="text-2xl font-bold mt-2">{variants.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Variant Comparison */}
            <Card>
                <CardHeader>
                    <CardTitle>Variant Performance</CardTitle>
                    <CardDescription>
                        Comparing {goalLabels[experiment.goal]} across all variants
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {sortedVariants.map((variant, index) => {
                        const metricValue = getMetricValue(variant);
                        const isLeader = index === 0 && totalCalls >= 5;
                        const isWinner = experiment.winner_variant_id === variant.id;

                        return (
                            <div key={variant.id} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{variant.name}</span>
                                        {variant.is_control && (
                                            <Badge variant="outline">Control</Badge>
                                        )}
                                        {isLeader && !isWinner && (
                                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                                <TrendingUp className="h-3 w-3 mr-1" />
                                                Leading
                                            </Badge>
                                        )}
                                        {isWinner && (
                                            <Badge className="bg-green-500">
                                                <Trophy className="h-3 w-3 mr-1" />
                                                Winner
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-bold">
                                            {metricValue.toFixed(experiment.goal === 'sentiment' ? 0 : 1)}{goalUnits[experiment.goal]}
                                        </span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                            ({variant.call_count || 0} calls)
                                        </span>
                                    </div>
                                </div>
                                <Progress
                                    value={maxMetricValue > 0 ? (metricValue / maxMetricValue) * 100 : 0}
                                    className="h-3"
                                />
                                <div className="flex gap-6 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {variant.avg_duration || 0}s avg
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Smile className="h-3 w-3" />
                                        {((variant.avg_sentiment || 0) * 100).toFixed(0)}% positive
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        {variant.conversion_rate || 0}% conversion
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {totalCalls < 10 && (
                        <div className="text-center py-4 text-muted-foreground">
                            <p>Need at least 10 calls to determine statistical significance</p>
                            <p className="text-sm">{10 - totalCalls} more calls needed</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Prompt Preview */}
            <Card>
                <CardHeader>
                    <CardTitle>Prompt Comparison</CardTitle>
                    <CardDescription>Review the prompts being tested</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        {variants.map((variant) => (
                            <Card key={variant.id} className={experiment.winner_variant_id === variant.id ? 'border-green-500' : ''}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-sm font-medium">{variant.name}</CardTitle>
                                        {variant.is_control && <Badge variant="outline" className="text-xs">Control</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 whitespace-pre-wrap">
                                        {variant.prompt}
                                    </pre>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
