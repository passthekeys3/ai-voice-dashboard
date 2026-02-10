import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ runId: string }>;
}

// GET /api/test-runs/[runId] - Get full run with all results
export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const { data: run, error } = await supabase
            .from('test_runs')
            .select(`
                *,
                test_suite:test_suites(id, name),
                test_results(
                    *,
                    test_case:test_cases(id, name, scenario, success_criteria, tags),
                    persona:test_personas(id, name, traits)
                )
            `)
            .eq('id', runId)
            .eq('agency_id', user.agency.id)
            .single();

        if (error || !run) {
            return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
        }

        // Sort results: failed first, then errored, then passed, then pending
        const statusOrder: Record<string, number> = {
            failed: 0,
            errored: 1,
            passed: 2,
            running: 3,
            pending: 4,
        };

        if (run.test_results) {
            run.test_results.sort(
                (a: { status: string }, b: { status: string }) =>
                    (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
            );
        }

        return NextResponse.json({ data: run });
    } catch (error) {
        console.error('Error fetching test run:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/test-runs/[runId] - Cancel a running test
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { runId } = await params;
        const body = await request.json();
        const supabase = await createClient();

        if (body.status === 'cancelled') {
            // Only allow cancelling pending or running tests
            const { data: run } = await supabase
                .from('test_runs')
                .select('status')
                .eq('id', runId)
                .eq('agency_id', user.agency.id)
                .single();

            if (!run) {
                return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
            }

            if (!['pending', 'running'].includes(run.status)) {
                return NextResponse.json({ error: 'Can only cancel pending or running tests' }, { status: 400 });
            }

            const { data: updated, error } = await supabase
                .from('test_runs')
                .update({
                    status: 'cancelled',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', runId)
                .eq('agency_id', user.agency.id)
                .select()
                .single();

            if (error) {
                console.error('Error cancelling test run:', error);
                return NextResponse.json({ error: 'Failed to cancel test run' }, { status: 500 });
            }

            return NextResponse.json({ data: updated });
        }

        return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    } catch (error) {
        console.error('Error updating test run:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
