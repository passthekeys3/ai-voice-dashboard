import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/test-suites/[id]/cases - List test cases in a suite
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: suiteId } = await params;
        const supabase = await createClient();

        // Verify suite belongs to this agency
        const { data: suite } = await supabase
            .from('test_suites')
            .select('id')
            .eq('id', suiteId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        const { data: cases, error } = await supabase
            .from('test_cases')
            .select('*, persona:test_personas(*)')
            .eq('test_suite_id', suiteId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching test cases:', error.code);
            return NextResponse.json({ error: 'Failed to fetch test cases' }, { status: 500 });
        }

        return NextResponse.json({ data: cases });
    } catch (error) {
        console.error('Error fetching test cases:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/test-suites/[id]/cases - Create one or more test cases
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: suiteId } = await params;
        const supabase = await createClient();

        // Verify suite belongs to this agency
        const { data: suite } = await supabase
            .from('test_suites')
            .select('id')
            .eq('id', suiteId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        const body = await request.json();

        // Support batch creation (array) or single creation (object)
        const casesToCreate = Array.isArray(body) ? body : [body];

        if (casesToCreate.length === 0) {
            return NextResponse.json({ error: 'At least one test case is required' }, { status: 400 });
        }

        if (casesToCreate.length > 100) {
            return NextResponse.json({ error: 'Maximum 100 test cases per request' }, { status: 400 });
        }

        // Get current max sort_order
        const { data: maxSortRow } = await supabase
            .from('test_cases')
            .select('sort_order')
            .eq('test_suite_id', suiteId)
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

        let nextSortOrder = (maxSortRow?.sort_order ?? -1) + 1;

        // Validate and prepare each case
        const insertData = [];
        for (const tc of casesToCreate) {
            if (!tc.name || !tc.name.trim()) {
                return NextResponse.json({ error: 'Each test case requires a name' }, { status: 400 });
            }
            if (tc.name.length > 255) {
                return NextResponse.json({ error: 'Test case name must be 255 characters or less' }, { status: 400 });
            }
            if (!tc.scenario || !tc.scenario.trim()) {
                return NextResponse.json({ error: 'Each test case requires a scenario' }, { status: 400 });
            }
            if (tc.scenario.length > 5000) {
                return NextResponse.json({ error: 'Test case scenario must be 5000 characters or less' }, { status: 400 });
            }
            if (Array.isArray(tc.success_criteria) && tc.success_criteria.length > 20) {
                return NextResponse.json({ error: 'Maximum 20 success criteria per test case' }, { status: 400 });
            }

            // Validate persona_id if provided — must be preset or belong to this agency
            if (tc.persona_id) {
                const { data: persona } = await supabase
                    .from('test_personas')
                    .select('id')
                    .eq('id', tc.persona_id)
                    .or(`is_preset.eq.true,agency_id.eq.${user.agency.id}`)
                    .single();

                if (!persona) {
                    return NextResponse.json({ error: 'Persona not found or not accessible' }, { status: 400 });
                }
            }

            // Validate max_turns bounds
            const maxTurns = tc.max_turns || 20;
            if (typeof maxTurns !== 'number' || maxTurns < 1 || maxTurns > 100) {
                return NextResponse.json(
                    { error: 'max_turns must be between 1 and 100' },
                    { status: 400 }
                );
            }

            insertData.push({
                test_suite_id: suiteId,
                persona_id: tc.persona_id || null,
                name: tc.name.trim(),
                description: tc.description?.trim() || null,
                scenario: tc.scenario.trim(),
                success_criteria: tc.success_criteria || [],
                max_turns: maxTurns,
                tags: tc.tags || [],
                is_active: tc.is_active !== undefined ? tc.is_active : true,
                sort_order: tc.sort_order !== undefined ? tc.sort_order : nextSortOrder++,
            });
        }

        const { data: cases, error } = await supabase
            .from('test_cases')
            .insert(insertData)
            .select('*, persona:test_personas(*)');

        if (error) {
            console.error('Error creating test cases:', error.code);
            return NextResponse.json({ error: 'Failed to create test cases' }, { status: 500 });
        }

        return NextResponse.json({ data: cases }, { status: 201 });
    } catch (error) {
        console.error('Error creating test cases:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
