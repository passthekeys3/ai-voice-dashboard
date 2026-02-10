import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

// GET /api/workflows/:id/executions - List executions for a specific workflow
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
        const { searchParams } = new URL(request.url);

        const parsedLimit = parseInt(searchParams.get('limit') || '20');
        const parsedOffset = parseInt(searchParams.get('offset') || '0');
        const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 100);
        const offset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;
        const status = searchParams.get('status');

        // Verify workflow belongs to this agency
        const { data: workflow, error: wfError } = await supabase
            .from('workflows')
            .select('id')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (wfError || !workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        let query = supabase
            .from('workflow_execution_log')
            .select('*', { count: 'exact' })
            .eq('workflow_id', id)
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Failed to fetch workflow executions:', error);
            return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 });
        }

        return NextResponse.json({
            executions: data || [],
            total: count || 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Workflow executions API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
