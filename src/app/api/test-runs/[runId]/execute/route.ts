import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { executeTestRun } from '@/lib/testing/runner';
import type { TestCase, TestPersona } from '@/types';

interface RouteParams {
    params: Promise<{ runId: string }>;
}

// POST /api/test-runs/[runId]/execute - Execute a test run with streaming progress
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { runId } = await params;
        const supabase = await createClient();

        // Fetch the run
        const { data: run } = await supabase
            .from('test_runs')
            .select('*')
            .eq('id', runId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!run) {
            return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
        }

        if (run.status !== 'pending') {
            return NextResponse.json(
                { error: `Cannot execute a run with status "${run.status}". Only pending runs can be executed.` },
                { status: 400 }
            );
        }

        // Fetch test cases for this run (via suite)
        const { data: testCases } = await supabase
            .from('test_cases')
            .select('*, persona:test_personas(*)')
            .eq('test_suite_id', run.test_suite_id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (!testCases || testCases.length === 0) {
            return NextResponse.json({ error: 'No active test cases found' }, { status: 400 });
        }

        // Stream progress back via ReadableStream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sendEvent = (data: any) => {
                    try {
                        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                    } catch {
                        // Stream may have been closed by client
                    }
                };

                // Start execution
                executeTestRun({
                    runId,
                    testCases: testCases as (TestCase & { persona?: TestPersona })[],
                    agentPrompt: run.prompt_tested,
                    agentFirstMessage: undefined,
                    supabase,
                    onProgress: (update) => {
                        sendEvent(update);
                    },
                })
                    .then(() => {
                        sendEvent({ type: 'done' });
                        controller.close();
                    })
                    .catch((err) => {
                        console.error('Test run execution error:', err);
                        sendEvent({
                            type: 'error',
                            message: err instanceof Error ? err.message : 'Execution failed',
                        });

                        // Mark run as failed
                        supabase
                            .from('test_runs')
                            .update({
                                status: 'failed',
                                completed_at: new Date().toISOString(),
                            })
                            .eq('id', runId)
                            .then(() => {
                                controller.close();
                            });
                    });
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error starting test run execution:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
