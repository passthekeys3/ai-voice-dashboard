import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

export async function GET() {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
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
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
