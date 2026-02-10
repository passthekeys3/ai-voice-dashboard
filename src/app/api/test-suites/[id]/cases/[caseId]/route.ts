import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string; caseId: string }>;
}

// PATCH /api/test-suites/[id]/cases/[caseId] - Update a test case
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: suiteId, caseId } = await params;
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

        // Verify case belongs to this suite
        const { data: existingCase } = await supabase
            .from('test_cases')
            .select('id')
            .eq('id', caseId)
            .eq('test_suite_id', suiteId)
            .single();

        if (!existingCase) {
            return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
        }

        const body = await request.json();
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) {
            if (!body.name.trim()) {
                return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
            }
            updateData.name = body.name.trim();
        }
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.scenario !== undefined) {
            if (!body.scenario.trim()) {
                return NextResponse.json({ error: 'Scenario cannot be empty' }, { status: 400 });
            }
            updateData.scenario = body.scenario.trim();
        }
        if (body.success_criteria !== undefined) updateData.success_criteria = body.success_criteria;
        if (body.max_turns !== undefined) updateData.max_turns = body.max_turns;
        if (body.tags !== undefined) updateData.tags = body.tags;
        if (body.is_active !== undefined) updateData.is_active = body.is_active;
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

        // Validate persona_id if provided
        if (body.persona_id !== undefined) {
            if (body.persona_id === null) {
                updateData.persona_id = null;
            } else {
                const { data: persona } = await supabase
                    .from('test_personas')
                    .select('id')
                    .eq('id', body.persona_id)
                    .or(`is_preset.eq.true,agency_id.eq.${user.agency.id}`)
                    .single();

                if (!persona) {
                    return NextResponse.json({ error: 'Persona not found' }, { status: 400 });
                }
                updateData.persona_id = body.persona_id;
            }
        }

        const { data: testCase, error } = await supabase
            .from('test_cases')
            .update(updateData)
            .eq('id', caseId)
            .eq('test_suite_id', suiteId)
            .select('*, persona:test_personas(*)')
            .single();

        if (error) {
            console.error('Error updating test case:', error);
            return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 });
        }

        return NextResponse.json({ data: testCase });
    } catch (error) {
        console.error('Error updating test case:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/test-suites/[id]/cases/[caseId] - Delete a test case
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: suiteId, caseId } = await params;
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

        const { error } = await supabase
            .from('test_cases')
            .delete()
            .eq('id', caseId)
            .eq('test_suite_id', suiteId);

        if (error) {
            console.error('Error deleting test case:', error);
            return NextResponse.json({ error: 'Failed to delete test case' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting test case:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
