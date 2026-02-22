import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/agents/[id]/webcall - Create a web call for testing
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: agentId } = await params;
        const supabase = createServiceClient();

        // Get agent details
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('external_id, provider, agency_id')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (agent.provider !== 'retell') {
            return NextResponse.json({ error: 'Web calls only supported for Retell agents' }, { status: 400 });
        }

        // Get agency API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'No Retell API key configured' }, { status: 400 });
        }

        // Create web call with Retell API
        const retellResponse = await fetch('https://api.retellai.com/v2/create-web-call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                agent_id: agent.external_id,
            }),
        });

        if (!retellResponse.ok) {
            console.error('Retell web call error:', retellResponse.status);
            return NextResponse.json({ error: 'Failed to create web call' }, { status: 500 });
        }

        const webCall = await retellResponse.json();

        return NextResponse.json({
            data: {
                access_token: webCall.access_token,
                call_id: webCall.call_id,
            }
        });
    } catch (error) {
        console.error('Error creating web call:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
