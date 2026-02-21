import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

export async function GET() {
    // Only allow in development mode — check both NODE_ENV and app URL
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
        return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createServiceClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key' }, { status: 400 });
        }

        // Fetch calls directly from Retell API
        const response = await fetch('https://api.retellai.com/v2/list-calls', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 10, sort_order: 'descending' }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch calls from Retell' }, { status: 502 });
        }

        const calls = await response.json();

        // Extract cost info from each call
        const costInfo = calls.map((c: { call_id: string; call_cost?: { combined_cost?: number } }) => ({
            call_id: c.call_id,
            has_call_cost: !!c.call_cost,
            combined_cost: c.call_cost?.combined_cost,
        }));

        return NextResponse.json({
            message: 'Retell cost debug',
            callsWithCost: costInfo.filter((c: { combined_cost?: number }) => c.combined_cost && c.combined_cost > 0).length,
            callsWithoutCost: costInfo.filter((c: { combined_cost?: number }) => !c.combined_cost || c.combined_cost === 0).length,
            samples: costInfo.slice(0, 5),
        });
    } catch (error) {
        console.error('Debug retell error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
