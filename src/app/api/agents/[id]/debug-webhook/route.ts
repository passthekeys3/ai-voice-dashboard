import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getRetellAgent } from '@/lib/providers/retell';

// GET /api/agents/[id]/debug-webhook — Fetch raw webhook config from Retell
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = await createClient();

        // Get the agent from our DB
        const { data: agent, error } = await supabase
            .from('agents')
            .select('external_id, provider, agency_id')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (error || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (agent.provider !== 'retell') {
            return NextResponse.json({ error: 'Only Retell agents supported' }, { status: 400 });
        }

        // Get agency API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Fetch raw agent from Retell API
        const retellAgent = await getRetellAgent(agency.retell_api_key, agent.external_id);

        return NextResponse.json({
            agent_id: retellAgent.agent_id,
            agent_name: retellAgent.agent_name,
            webhook_url: retellAgent.webhook_url || null,
            webhook_events: retellAgent.webhook_events || [],
            computed_webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'NOT_SET')}/api/webhooks/retell`,
            env: {
                NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',
                VERCEL_URL: process.env.VERCEL_URL || 'NOT_SET',
            },
        });
    } catch (error) {
        console.error('Debug webhook error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
