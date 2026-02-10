import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

// GET /api/workflows/executions - List all workflow executions
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const parsedLimit = parseInt(searchParams.get('limit') || '50');
        const parsedOffset = parseInt(searchParams.get('offset') || '0');
        const limit = Math.min(Number.isNaN(parsedLimit) ? 50 : parsedLimit, 100);
        const offset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;
        const status = searchParams.get('status');
        const workflowId = searchParams.get('workflow_id');
        const callId = searchParams.get('call_id');

        let query = supabase
            .from('workflow_execution_log')
            .select('*, workflow:workflows(name)', { count: 'exact' })
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        if (workflowId) {
            query = query.eq('workflow_id', workflowId);
        }

        if (callId) {
            query = query.eq('call_id', callId);
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
