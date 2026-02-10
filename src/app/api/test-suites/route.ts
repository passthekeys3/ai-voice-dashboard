import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getAgentPrompt } from '@/lib/testing/get-agent-prompt';

// GET /api/test-suites - List all test suites
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
        const agentId = searchParams.get('agent_id');

        // Validate agent_id belongs to this agency if provided
        if (agentId) {
            const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agentId)
                .eq('agency_id', user.agency.id)
                .single();

            if (!agent) {
                return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
            }
        }

        let query = supabase
            .from('test_suites')
            .select(`
                *,
                agent:agents(name),
                test_cases(id),
                latest_run:test_runs(id, status, passed_cases, failed_cases, errored_cases, avg_score, created_at)
            `)
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false });

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        // Only get the most recent run per suite
        query = query.order('created_at', { referencedTable: 'test_runs', ascending: false }).limit(1, { referencedTable: 'test_runs' });

        const { data: suites, error } = await query;

        if (error) {
            console.error('Error fetching test suites:', error);
            return NextResponse.json({ error: 'Failed to fetch test suites' }, { status: 500 });
        }

        return NextResponse.json({ data: suites });
    } catch (error) {
        console.error('Error fetching test suites:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/test-suites - Create a new test suite
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, agent_id } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!agent_id) {
            return NextResponse.json({ error: 'Agent is required' }, { status: 400 });
        }

        const supabase = await createClient();

        // Verify agent belongs to this agency and get its details
        const { data: agent } = await supabase
            .from('agents')
            .select('id, name, provider, config, agency_id')
            .eq('id', agent_id)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Snapshot the agent's current prompt
        let promptSnapshot: string | null = null;
        try {
            // Get provider credentials
            const { data: agency } = await supabase
                .from('agencies')
                .select('retell_api_key, vapi_api_key')
                .eq('id', user.agency.id)
                .single();

            const apiKey = agent.provider === 'retell'
                ? agency?.retell_api_key
                : agency?.vapi_api_key;

            if (apiKey && agent.config?.external_id) {
                const result = await getAgentPrompt({
                    provider: agent.provider as 'retell' | 'vapi',
                    apiKey,
                    externalId: agent.config.external_id,
                    localConfig: agent.config,
                });
                promptSnapshot = result?.prompt || null;
            }

            // Fallback to local config if provider fetch failed
            if (!promptSnapshot) {
                const config = agent.config || {};
                promptSnapshot = config.prompt || config.llm_prompt || config.system_prompt || null;
            }
        } catch (err) {
            console.warn('Could not snapshot agent prompt:', err);
            // Continue without snapshot — not a fatal error
        }

        const { data: suite, error } = await supabase
            .from('test_suites')
            .insert({
                agency_id: user.agency.id,
                agent_id,
                name: name.trim(),
                description: description?.trim() || null,
                agent_prompt_snapshot: promptSnapshot,
            })
            .select('*, agent:agents(name)')
            .single();

        if (error) {
            console.error('Error creating test suite:', error);
            return NextResponse.json({ error: 'Failed to create test suite' }, { status: 500 });
        }

        return NextResponse.json({ data: suite }, { status: 201 });
    } catch (error) {
        console.error('Error creating test suite:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
