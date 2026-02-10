'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    DollarSign,
    Target,
    BarChart3,
} from 'lucide-react';
import { TestTranscript } from './TestTranscript';
import type { TestRun, TestResult, CriterionResult } from '@/types';

interface TestRunResultsProps {
    run: TestRun & {
        test_suite?: { id: string; name: string };
        test_results?: (TestResult & {
            test_case?: { id: string; name: string; scenario: string; success_criteria: unknown[]; tags: string[] };
            persona?: { id: string; name: string; traits: Record<string, string> };
        })[];
    };
}

const STATUS_ICON = {
    passed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    failed: <XCircle className="h-4 w-4 text-red-600" />,
    errored: <AlertCircle className="h-4 w-4 text-amber-600" />,
    running: <Clock className="h-4 w-4 text-blue-600" />,
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
};

function CriteriaResultsView({ results }: { results: CriterionResult[] }) {
    if (!results || results.length === 0) return null;

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Criteria Results
            </p>
            {results.map((cr, i) => (
                <div
                    key={i}
                    className={`p-2.5 rounded border text-sm ${
                        cr.passed
                            ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {cr.passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium">{cr.criterion}</span>
                        <Badge
                            variant={
                                cr.type === 'must_pass'
                                    ? 'default'
                                    : cr.type === 'must_not_fail'
                                      ? 'destructive'
                                      : 'secondary'
                            }
                            className="text-xs ml-auto"
                        >
                            {cr.type.replace(/_/g, ' ')}
                        </Badge>
                    </div>
                    {cr.reasoning && (
                        <p className="text-xs text-muted-foreground mt-1.5 ml-5">
                            {cr.reasoning}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

export function TestRunResults({ run }: TestRunResultsProps) {
    const [openResults, setOpenResults] = useState<Set<string>>(new Set());
    const results = run.test_results || [];

    const toggleResult = (id: string) => {
        setOpenResults((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const passRate = run.total_cases > 0
        ? Math.round((run.passed_cases / run.total_cases) * 100)
        : 0;

    const formatDuration = (ms?: number) => {
        if (!ms) return '—';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatCost = (cents?: number) => {
        if (!cents) return '—';
        return `$${(cents / 100).toFixed(2)}`;
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <Target className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                            {run.passed_cases}/{run.total_cases}
                        </p>
                        <p className="text-xs text-muted-foreground">Passed ({passRate}%)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                            {run.avg_score != null ? `${run.avg_score}%` : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                            {formatDuration(run.duration_ms)}
                        </p>
                        <p className="text-xs text-muted-foreground">Duration</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <DollarSign className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                            {formatCost(run.estimated_cost_cents)}
                        </p>
                        <p className="text-xs text-muted-foreground">Est. Cost</p>
                    </CardContent>
                </Card>
            </div>

            {/* Results list */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Test Results</CardTitle>
                    <CardDescription>
                        Sorted by status: failed first, then errored, then passed
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {results.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No results yet
                        </p>
                    )}

                    {results.map((result) => (
                        <Collapsible
                            key={result.id}
                            open={openResults.has(result.id)}
                            onOpenChange={() => toggleResult(result.id)}
                        >
                            <div className="border rounded-lg">
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                        {openResults.has(result.id) ? (
                                            <ChevronDown className="h-4 w-4 shrink-0" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 shrink-0" />
                                        )}
                                        {STATUS_ICON[result.status]}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium">
                                                {result.test_case?.name || 'Unknown Test'}
                                            </span>
                                            {result.persona && (
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    ({result.persona.name})
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {result.overall_score != null && (
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${
                                                        result.overall_score >= 80
                                                            ? 'text-green-600 border-green-300'
                                                            : result.overall_score >= 60
                                                              ? 'text-amber-600 border-amber-300'
                                                              : 'text-red-600 border-red-300'
                                                    }`}
                                                >
                                                    {result.overall_score}%
                                                </Badge>
                                            )}
                                            {result.turn_count > 0 && (
                                                <span className="text-xs text-muted-foreground">
                                                    {result.turn_count} turns
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {formatDuration(result.duration_ms)}
                                            </span>
                                        </div>
                                    </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <div className="border-t p-4 space-y-4">
                                        {/* Error message */}
                                        {result.error_message && (
                                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm text-red-800 dark:text-red-200">
                                                {result.error_message}
                                            </div>
                                        )}

                                        {/* Evaluation summary */}
                                        {result.evaluation_summary && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                                    Evaluation Summary
                                                </p>
                                                <p className="text-sm">{result.evaluation_summary}</p>
                                            </div>
                                        )}

                                        {/* Metadata */}
                                        <div className="flex flex-wrap gap-2">
                                            {result.sentiment && (
                                                <Badge variant="outline" className="text-xs">
                                                    Sentiment: {result.sentiment}
                                                </Badge>
                                            )}
                                            {result.topics?.map((topic) => (
                                                <Badge key={topic} variant="secondary" className="text-xs">
                                                    {topic}
                                                </Badge>
                                            ))}
                                        </div>

                                        {/* Criteria results */}
                                        {result.criteria_results && result.criteria_results.length > 0 && (
                                            <CriteriaResultsView results={result.criteria_results} />
                                        )}

                                        {/* Transcript */}
                                        {result.transcript && result.transcript.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                                    Conversation Transcript
                                                </p>
                                                <TestTranscript transcript={result.transcript} />
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
