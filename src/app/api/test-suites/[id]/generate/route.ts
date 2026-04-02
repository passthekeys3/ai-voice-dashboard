import { NextRequest, NextResponse } from 'next/server';
import type { VoiceProvider } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { decrypt } from '@/lib/crypto';
import { generateScenariosStream } from '@/lib/testing/scenario-generator';
import { getAgentPrompt } from '@/lib/testing/get-agent-prompt';
import { isValidUuid } from '@/lib/validation';
import { PROVIDER_KEY_SELECT, type ProviderKeyRow } from '@/lib/constants/config';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/test-suites/[id]/generate - AI-generate test scenarios
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ---- Tier gate: Agent Testing requires Agency ----
        const genTierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'agent_testing', user.agency.beta_ends_at);
        if (genTierError) {
            return NextResponse.json({ error: genTierError }, { status: 403 });
        }

        const { id: suiteId } = await params;
        if (!isValidUuid(suiteId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = await createClient();

        // Fetch suite with agent info
        const { data: suite } = await supabase
            .from('test_suites')
            .select('*, agent:agents(id, name, provider, config)')
            .eq('id', suiteId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!suite) {
            return NextResponse.json({ error: 'Test suite not found' }, { status: 404 });
        }

        // Resolve the agent prompt
        let agentPrompt: string | null = null;

        try {
            const { data: agency } = await supabase
                .from('agencies')
                .select(PROVIDER_KEY_SELECT)
                .eq('id', user.agency.id)
                .single() as { data: ProviderKeyRow | null };

            const agent = suite.agent;
            const apiKey = decrypt(
                agent.provider === 'retell'
                    ? agency?.retell_api_key
                    : agent.provider === 'bland'
                    ? agency?.bland_api_key
                    : agent.provider === 'elevenlabs'
                    ? agency?.elevenlabs_api_key
                    : agency?.vapi_api_key
            );

            if (apiKey && agent.config?.external_id) {
                const result = await getAgentPrompt({
                    provider: agent.provider as VoiceProvider,
                    apiKey,
                    externalId: agent.config.external_id,
                    localConfig: agent.config,
                });
                agentPrompt = result?.prompt || null;
            }
        } catch {
            // Fall through to snapshot
        }

        // Fallback to snapshot or local config
        if (!agentPrompt) {
            agentPrompt = suite.agent_prompt_snapshot;
        }
        if (!agentPrompt && suite.agent?.config) {
            const config = suite.agent.config;
            agentPrompt = config.prompt || config.llm_prompt || config.system_prompt || null;
        }

        if (!agentPrompt) {
            return NextResponse.json(
                { error: 'Could not resolve agent prompt. Ensure the agent has a prompt configured.' },
                { status: 400 }
            );
        }

        // Generate scenarios via streaming
        const stream = await generateScenariosStream(agentPrompt, suite.agent?.name);

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error generating test scenarios:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
