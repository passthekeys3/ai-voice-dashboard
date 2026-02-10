import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { listBlandActiveCalls } from '@/lib/providers/bland';

// GET /api/calls/active - Get all active calls from all configured providers
export async function GET(_request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // Get agency's API keys for all providers
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key, vapi_api_key, bland_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key && !agency?.vapi_api_key && !agency?.bland_api_key) {
            return NextResponse.json({ data: [] });
        }

        // Fetch agents for this agency (filter by client for non-admin users)
        let agentsQuery = supabase
            .from('agents')
            .select('id, name, external_id, client_id, provider')
            .eq('agency_id', user.agency.id);

        // Client users can only see calls from agents assigned to their client
        if (!isAgencyAdmin(user) && user.client) {
            agentsQuery = agentsQuery.eq('client_id', user.client.id);
        }

        const { data: agents } = await agentsQuery;

        const agentMap = new Map(
            agents?.map(a => [a.external_id, { id: a.id, name: a.name, provider: a.provider }]) || []
        );

        const retellAgentIds = agents
            ?.filter(a => a.provider === 'retell')
            .map(a => a.external_id)
            .filter(Boolean) || [];

        if (agents?.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const allActiveCalls: Array<{
            id: string;
            external_id: string;
            agent_id: string;
            agent_name: string;
            status: string;
            started_at: string;
            duration_seconds: number;
            from_number?: string;
            to_number?: string;
            direction: string;
            provider: string;
        }> = [];

        // Fetch active calls from Retell
        if (agency.retell_api_key && retellAgentIds.length > 0) {
            try {
                const retellResponse = await fetch('https://api.retellai.com/v2/list-calls', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${agency.retell_api_key}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filter_criteria: {
                            agent_id: retellAgentIds,
                            call_status: ['ongoing'],
                        },
                        limit: 50,
                    }),
                });

                if (retellResponse.ok) {
                    const retellData = await retellResponse.json();
                    for (const call of (retellData || [])) {
                        allActiveCalls.push({
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
                            provider: 'retell',
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching Retell active calls:', err);
            }
        }

        // Fetch active calls from Bland
        if (agency.bland_api_key) {
            try {
                const blandCalls = await listBlandActiveCalls(agency.bland_api_key);
                for (const call of blandCalls) {
                    const agentInfo = call.pathway_id ? agentMap.get(call.pathway_id) : undefined;
                    // Only include calls for agents we know about
                    if (agentInfo || !call.pathway_id) {
                        allActiveCalls.push({
                            id: call.call_id,
                            external_id: call.call_id,
                            agent_id: call.pathway_id || '',
                            agent_name: agentInfo?.name || 'Bland Call',
                            status: 'ongoing',
                            started_at: call.started_at || call.created_at,
                            duration_seconds: call.call_length
                                ? Math.round(call.call_length * 60)
                                : 0,
                            from_number: call.from,
                            to_number: call.to,
                            direction: 'outbound',
                            provider: 'bland',
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching Bland active calls:', err);
            }
        }

        // Note: Vapi doesn't have a dedicated active calls endpoint
        // Active Vapi calls are tracked via webhook events in real-time

        return NextResponse.json({ data: allActiveCalls });
    } catch (error) {
        console.error('Error fetching active calls:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
