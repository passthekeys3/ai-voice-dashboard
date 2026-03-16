import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

/**
 * GET /api/webhook-deliveries
 *
 * Returns the most recent webhook delivery attempts for the authenticated agency.
 * Used to display delivery history in the API & Webhooks settings panel.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createAdminClient();
        const { data: deliveries, error } = await supabase
            .from('webhook_delivery_log')
            .select('id, call_id, event, webhook_url, status_code, success, error_message, attempt, created_at')
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Failed to fetch webhook deliveries:', error.code);
            return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
        }

        return NextResponse.json({ deliveries: deliveries || [] });
    } catch (err) {
        console.error('Webhook deliveries error:', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
