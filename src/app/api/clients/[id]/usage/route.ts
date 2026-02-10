import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentUsage } from '@/lib/billing/usage';

/**
 * GET /api/clients/[id]/usage
 *
 * Returns the current billing period's usage for a per-minute client.
 * Agency-scoped: verifies the client belongs to the user's agency.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Verify client belongs to this agency
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, name, billing_type, billing_amount_cents')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (clientError || !client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        if (client.billing_type !== 'per_minute') {
            return NextResponse.json({ error: 'Client is not on per-minute billing' }, { status: 400 });
        }

        const usage = await getCurrentUsage(supabase, id);

        // Calculate current period dates for display
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

        return NextResponse.json({
            usage: usage || { total_calls: 0, total_minutes: 0, total_cost_cents: 0 },
            billingRate: client.billing_amount_cents || 0,
            period: {
                start: periodStart.toISOString().split('T')[0],
                end: periodEnd.toISOString().split('T')[0],
                label: periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
            },
        });
    } catch (err) {
        console.error('Failed to get client usage:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
