import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/admin';
import { withErrorHandling } from '@/lib/api/response';

const VALID_PLAN_TYPES = ['self_service', 'managed'] as const;

/**
 * PATCH — Update an agency's plan_type.
 * Only platform admins can call this.
 */
export const PATCH = withErrorHandling(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    try {
        const authSupabase = await createAuthClient();
        const { data: { user } } = await authSupabase.auth.getUser();

        if (!user?.email || !isPlatformAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agencyId } = await params;

        if (!agencyId) {
            return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 });
        }

        const body = await request.json();
        const { plan_type } = body;

        if (!plan_type || !VALID_PLAN_TYPES.includes(plan_type)) {
            return NextResponse.json(
                { error: `plan_type must be one of: ${VALID_PLAN_TYPES.join(', ')}` },
                { status: 400 },
            );
        }

        const supabase = createServiceClient();

        const { data: agency, error } = await supabase
            .from('agencies')
            .update({ plan_type })
            .eq('id', agencyId)
            .select('id, name, plan_type')
            .single();

        if (error || !agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        return NextResponse.json(agency);
    } catch (err) {
        console.error('[ADMIN] PATCH agency error:', err instanceof Error ? err.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
