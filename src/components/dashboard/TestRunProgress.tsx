'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { TestProgressUpdate } from '@/types';

interface TestRunProgressProps {
    runId: string;
    onComplete: () => void;
}

interface CaseStatus {
    case_id: string;
    case_name: string;
    status: 'running' | 'passed' | 'failed' | 'errored';
    score?: number;
}

export function TestRunProgress({ runId, onComplete }: TestRunProgressProps) {
    const [total, setTotal] = useState(0);
    const [completed, setCompleted] = useState(0);
    const [caseStatuses, setCaseStatuses] = useState<CaseStatus[]>([]);
    const [currentCase, setCurrentCase] = useState<string | null>(null);
    const [finalResult, setFinalResult] = useState<{
        passed: number;
        failed: number;
        errored: number;
        avg_score?: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        const execute = async () => {
            try {
                const res = await fetch(`/api/test-runs/${runId}/execute`, {
                    method: 'POST',
                });

                if (!res.ok) {
                    const data = await res.json();
                    setError(data.error || 'Execution failed');
                    return;
                }

                const reader = res.body?.getReader();
                if (!reader) {
                    setError('No response stream');
                    return;
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const event = JSON.parse(line) as TestProgressUpdate & { type: string };

                            switch (event.type) {
                                case 'started':
                                    setTotal(event.total || 0);
                                    break;

                                case 'case_started':
                                    setCurrentCase(event.case_name || null);
                                    if (event.case_id && event.case_name) {
                                        setCaseStatuses((prev) => [
                                            ...prev,
                                            {
                                                case_id: event.case_id!,
                                                case_name: event.case_name!,
                                                status: 'running',
                                            },
                                        ]);
                                    }
                                    break;

                                case 'case_completed':
                                    if (event.case_id) {
                                        setCaseStatuses((prev) =>
                                            prev.map((c) =>
                                                c.case_id === event.case_id
                                                    ? {
                                                          ...c,
                                                          status: (event.status || 'errored') as CaseStatus['status'],
                                                          score: event.score,
                                                      }
                                                    : c
                                            )
                                        );
                                    }
                                    break;

                                case 'progress':
                                    setCompleted(event.completed || 0);
                                    break;

                                case 'complete':
                                    setFinalResult({
                                        passed: event.passed || 0,
                                        failed: event.failed || 0,
                                        errored: event.errored || 0,
                                        avg_score: event.avg_score,
                                    });
                                    break;

                                case 'error':
                                    setError(event.message || 'Execution failed');
                                    break;

                                default:
                                    // 'done' and other types — ignore
                                    break;
                            }
                        } catch {
                            // Skip unparseable lines
                        }
                    }
                }

                // Signal completion
                setTimeout(onComplete, 1500);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Execution failed');
            }
        };

        execute();
    }, [runId, onComplete]);

    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    {finalResult ? (
                        <>
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Test Run Complete
                        </>
                    ) : error ? (
                        <>
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            Test Run Failed
                        </>
                    ) : (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Running Tests...
                        </>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress bar */}
                {!error && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {completed} of {total} test cases
                            </span>
                            <span className="font-medium">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} />
                        {currentCase && !finalResult && (
                            <p className="text-sm text-muted-foreground">
                                Currently running: {currentCase}
                            </p>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {/* Final summary */}
                {finalResult && (
                    <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-center">
                            <p className="text-2xl font-bold text-green-600">{finalResult.passed}</p>
                            <p className="text-xs text-green-700 dark:text-green-300">Passed</p>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-center">
                            <p className="text-2xl font-bold text-red-600">{finalResult.failed}</p>
                            <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-center">
                            <p className="text-2xl font-bold text-amber-600">{finalResult.errored}</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300">Errored</p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                            <p className="text-2xl font-bold text-blue-600">
                                {finalResult.avg_score != null ? `${finalResult.avg_score}%` : '—'}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">Avg Score</p>
                        </div>
                    </div>
                )}

                {/* Live case statuses */}
                {caseStatuses.length > 0 && (
                    <div className="space-y-2">
                        {caseStatuses.map((cs) => (
                            <div
                                key={cs.case_id}
                                className="flex items-center justify-between text-sm py-1.5 px-2 rounded"
                            >
                                <div className="flex items-center gap-2">
                                    {cs.status === 'running' && (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                    )}
                                    {cs.status === 'passed' && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    )}
                                    {cs.status === 'failed' && (
                                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                                    )}
                                    {cs.status === 'errored' && (
                                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                    )}
                                    <span>{cs.case_name}</span>
                                </div>
                                {cs.score != null && (
                                    <Badge variant="outline" className="text-xs">
                                        {cs.score}%
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
