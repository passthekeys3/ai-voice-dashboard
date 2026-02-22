import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/test-suites/[id] - Get suite with cases, personas, and latest runs
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = await createClient();

        // Fetch suite with test cases (and their personas) + recent runs
        const { data: suite, error } = await supabase
            .from('test_suites')
            .select(`
                *,
                agent:agents(id, name, provider, config),
                test_cases(
                    *,
                    persona:test_personas(*)
                ),
                test_runs(id, status, passed_cases, failed_cases, errored_cases, avg_score, total_cases, duration_ms, estimated_cost_cents, created_at)
            `)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .order('sort_order', { referencedTable: 'test_cases', ascending: true })
            .order('created_at', { referencedTable: 'test_runs', ascending: false })
            .limit(10, { referencedTable: 'test_runs' })
            .single();

        if (error || !suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        return NextResponse.json({ data: suite });
    } catch (error) {
        console.error('Error fetching test suite:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/test-suites/[id] - Update suite metadata
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;

        const { data: suite, error } = await supabase
            .from('test_suites')
            .update(updateData)
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .select('*, agent:agents(name)')
            .single();

        if (error) {
            console.error('Error updating test suite:', error.code);
            return NextResponse.json({ error: 'Failed to update test suite' }, { status: 500 });
        }

        if (!suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        return NextResponse.json({ data: suite });
    } catch (error) {
        console.error('Error updating test suite:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/test-suites/[id] - Delete a test suite (cascades to cases, runs, results)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = await createClient();

        // Check for running test runs first
        const { data: runningRuns } = await supabase
            .from('test_runs')
            .select('id')
            .eq('test_suite_id', id)
            .eq('status', 'running')
            .limit(1);

        if (runningRuns && runningRuns.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete suite with running tests. Wait for tests to complete or cancel them first.' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('test_suites')
            .delete()
            .eq('id', id)
            .eq('agency_id', user.agency.id);

        if (error) {
            console.error('Error deleting test suite:', error.code);
            return NextResponse.json({ error: 'Failed to delete test suite' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting test suite:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
