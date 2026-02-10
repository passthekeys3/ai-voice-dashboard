import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getAgentPrompt } from '@/lib/testing/get-agent-prompt';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/test-suites/[id]/runs - List runs for a suite
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: suiteId } = await params;
        const supabase = await createClient();

        // Verify suite belongs to this agency
        const { data: suite } = await supabase
            .from('test_suites')
            .select('id')
            .eq('id', suiteId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        const { data: runs, error } = await supabase
            .from('test_runs')
            .select('*')
            .eq('test_suite_id', suiteId)
            .eq('agency_id', user.agency.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching test runs:', error);
            return NextResponse.json({ error: 'Failed to fetch test runs' }, { status: 500 });
        }

        return NextResponse.json({ data: runs });
    } catch (error) {
        console.error('Error fetching test runs:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/test-suites/[id]/runs - Create a new test run (prepares it for execution)
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: suiteId } = await params;
        const supabase = await createClient();

        // Fetch suite with agent info
        const { data: suite } = await supabase
            .from('test_suites')
            .select('*, agent:agents(id, name, provider, config, agency_id)')
            .eq('id', suiteId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        // Fetch active test cases
        const { data: testCases } = await supabase
            .from('test_cases')
            .select('*, persona:test_personas(*)')
            .eq('test_suite_id', suiteId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (!testCases || testCases.length === 0) {
            return NextResponse.json({ error: 'No active test cases in this suite' }, { status: 400 });
        }

        // Resolve the prompt to test
        const body = await request.json().catch(() => ({}));
        const promptSource = body.prompt_source || 'current';
        let promptTested: string | null = null;

        // Validate prompt_source enum
        const validPromptSources = ['current', 'custom', 'experiment_variant'];
        if (!validPromptSources.includes(promptSource)) {
            return NextResponse.json(
                { error: `Invalid prompt_source. Must be one of: ${validPromptSources.join(', ')}` },
                { status: 400 }
            );
        }

        if (promptSource === 'custom' && body.custom_prompt) {
            promptTested = body.custom_prompt;
        } else if (promptSource === 'experiment_variant' && body.experiment_variant_id) {
            // Fetch variant prompt — verify it belongs to this agency via experiment join
            const { data: variant } = await supabase
                .from('experiment_variants')
                .select('prompt, experiment:experiments(agency_id)')
                .eq('id', body.experiment_variant_id)
                .single();

            if (!variant) {
                return NextResponse.json({ error: 'Experiment variant not found' }, { status: 404 });
            }

            // Verify agency ownership through the experiment
            const experiment = variant.experiment as unknown as { agency_id: string }[] | null;
            if (!experiment?.[0] || experiment[0].agency_id !== user.agency.id) {
                return NextResponse.json({ error: 'Experiment variant not found' }, { status: 404 });
            }

            promptTested = variant.prompt;
        } else {
            // Fetch current prompt from provider
            try {
                const { data: agency } = await supabase
                    .from('agencies')
                    .select('retell_api_key, vapi_api_key, bland_api_key')
                    .eq('id', user.agency.id)
                    .single();

                const agent = suite.agent;
                const apiKey = agent?.provider === 'retell'
                    ? agency?.retell_api_key
                    : agent?.provider === 'bland'
                    ? agency?.bland_api_key
                    : agency?.vapi_api_key;

                if (apiKey && agent?.config?.external_id) {
                    const result = await getAgentPrompt({
                        provider: agent.provider as 'retell' | 'vapi' | 'bland',
                        apiKey,
                        externalId: agent.config.external_id,
                        localConfig: agent.config,
                    });
                    promptTested = result?.prompt || null;
                }
            } catch {
                // Fall through to snapshot
            }

            // Fallback to snapshot
            if (!promptTested) {
                promptTested = suite.agent_prompt_snapshot;
            }

            // Final fallback to local config
            if (!promptTested) {
                const config = suite.agent?.config as Record<string, string> | undefined;
                if (config) {
                    promptTested = config.prompt || config.llm_prompt || config.system_prompt || null;
                }
            }
        }

        if (!promptTested) {
            return NextResponse.json(
                { error: 'Could not resolve agent prompt. Ensure the agent has a prompt configured.' },
                { status: 400 }
            );
        }

        // Create the run
        const { data: run, error: runError } = await supabase
            .from('test_runs')
            .insert({
                agency_id: user.agency.id,
                test_suite_id: suiteId,
                agent_id: suite.agent_id,
                prompt_tested: promptTested,
                prompt_source: promptSource,
                experiment_variant_id: body.experiment_variant_id || null,
                status: 'pending',
                total_cases: testCases.length,
            })
            .select()
            .single();

        if (runError) {
            console.error('Error creating test run:', runError);
            return NextResponse.json({ error: 'Failed to create test run' }, { status: 500 });
        }

        // Create pending result records for each test case
        const resultData = testCases.map((tc) => ({
            test_run_id: run.id,
            test_case_id: tc.id,
            persona_id: tc.persona_id || null,
            status: 'pending',
        }));

        const { error: resultsError } = await supabase
            .from('test_results')
            .insert(resultData);

        if (resultsError) {
            console.error('Error creating test result records:', resultsError);
            // Clean up the run
            await supabase.from('test_runs').delete().eq('id', run.id);
            return NextResponse.json({ error: 'Failed to create test run' }, { status: 500 });
        }

        return NextResponse.json({ data: run }, { status: 201 });
    } catch (error) {
        console.error('Error creating test run:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
