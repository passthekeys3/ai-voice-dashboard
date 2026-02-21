'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TestRunProgress } from '@/components/dashboard/TestRunProgress';
import { TestRunResults } from '@/components/dashboard/TestRunResults';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, TestTube2 } from 'lucide-react';
import type { TestRun, TestResult } from '@/types';

type FullRun = TestRun & {
    test_suite?: { id: string; name: string };
    test_results?: (TestResult & {
        test_case?: { id: string; name: string; scenario: string; success_criteria: unknown[]; tags: string[] };
        persona?: { id: string; name: string; traits: Record<string, string> };
    })[];
};

export default function TestRunPage() {
    const params = useParams();
    const router = useRouter();
    const runId = params.runId as string;
    const suiteId = params.id as string;

    const [run, setRun] = useState<FullRun | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);

    const fetchRun = useCallback(async () => {
        try {
            const res = await fetch(`/api/test-runs/${runId}`);
            if (!res.ok) {
                throw new Error('Failed to fetch test run');
            }
            const data = await res.json();
            if (data.data) {
                setRun(data.data);
                // If run is pending, we need to execute it
                if (data.data.status === 'pending') {
                    setIsExecuting(true);
                }
            }
        } catch (err) {
            console.error('Failed to fetch run:', err);
        } finally {
            setLoading(false);
        }
    }, [runId]);

    useEffect(() => {
        fetchRun();
    }, [fetchRun]);

    const handleExecutionComplete = useCallback(() => {
        setIsExecuting(false);
        // Refresh run data to show results
        fetchRun();
    }, [fetchRun]);

    const pageTitle = run?.test_suite?.name ? `Run: ${run.test_suite.name}` : 'Test Run';

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="border-b px-6 py-4">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <TestTube2 className="h-5 w-5" />
                        Test Run
                    </h1>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (!run) {
        return (
            <div className="flex flex-col h-full">
                <div className="border-b px-6 py-4">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <TestTube2 className="h-5 w-5" />
                        Test Run
                    </h1>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground">Test run not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="border-b px-6 py-4">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <TestTube2 className="h-5 w-5" />
                    {pageTitle}
                </h1>
            </div>

            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Back button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/testing/${suiteId}`)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Suite
                    </Button>

                    {/* Show progress if executing */}
                    {isExecuting && (
                        <TestRunProgress
                            runId={runId}
                            onComplete={handleExecutionComplete}
                        />
                    )}

                    {/* Show results when complete */}
                    {!isExecuting && run.status !== 'pending' && (
                        <TestRunResults run={run} />
                    )}
                </div>
            </div>
        </div>
    );
}
