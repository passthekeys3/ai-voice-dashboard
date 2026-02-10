import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

// GET /api/calls/active - Get all active calls from Retell
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Get agency's Retell API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Fetch agents for this agency (filter by client for non-admin users)
        let agentsQuery = supabase
            .from('agents')
            .select('id, name, external_id, client_id')
            .eq('agency_id', user.agency.id);

        // Client users can only see calls from agents assigned to their client
        if (!isAgencyAdmin(user) && user.client) {
            agentsQuery = agentsQuery.eq('client_id', user.client.id);
        }

        const { data: agents } = await agentsQuery;

        const agentMap = new Map(
            agents?.map(a => [a.external_id, { id: a.id, name: a.name }]) || []
        );
        const agentIds = agents?.map(a => a.external_id).filter(Boolean) || [];

        if (agentIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Fetch active calls from Retell
        const retellResponse = await fetch('https://api.retellai.com/v2/list-calls', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filter_criteria: {
                    agent_id: agentIds,
                    call_status: ['ongoing'],
                },
                limit: 50,
            }),
        });

        if (!retellResponse.ok) {
            const errorData = await retellResponse.json().catch(() => ({}));
            console.error('Retell API error:', errorData);
            return NextResponse.json({ error: 'Failed to fetch calls from Retell' }, { status: 500 });
        }

        const retellData = await retellResponse.json();

        // Map to our format with agent names
        const activeCalls = (retellData || []).map((call: {
            call_id: string;
            agent_id: string;
            call_status: string;
            start_timestamp: number;
            from_number?: string;
            to_number?: string;
            direction?: string;
            transcript?: string;
        }) => ({
            id: call.call_id,
            external_id: call.call_id,
            agent_id: call.agent_id,
            agent_name: agentMap.get(call.agent_id)?.name || 'Unknown Agent',
            status: call.call_status,
            started_at: new Date(call.start_timestamp).toISOString(),
            duration_seconds: Math.floor((Date.now() - call.start_timestamp) / 1000),
            from_number: call.from_number,
            to_number: call.to_number,
            direction: call.direction || 'outbound',
            provider: 'retell' as const,
        }));

        return NextResponse.json({ data: activeCalls });
    } catch (error) {
        console.error('Error fetching active calls:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
