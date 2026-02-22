import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getRetellAgentVersions, REQUIRED_WEBHOOK_EVENTS } from '@/lib/providers/retell';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/agents/[id]/webhook-status
 * Diagnostic endpoint: shows webhook config for draft AND published versions
 * of a Retell agent. Helps verify that transcript_updated is enabled on the
 * published version (which is what live phone calls use).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: agentId } = await params;
        const supabase = await createClient();

        // Get our agent record to find external_id
        const { data: agent } = await supabase
            .from('agents')
            .select('external_id, provider, name, agency_id, agencies(retell_api_key)')
            .eq('id', agentId)
            .eq('agency_id', user.agency.id)
            .single();

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (agent.provider !== 'retell') {
            return NextResponse.json({ error: 'Only Retell agents supported' }, { status: 400 });
        }

        type AgentWithAgency = typeof agent & {
            agencies: { retell_api_key: string | null } | null;
        };
        const agentWithAgency = agent as AgentWithAgency;
        const apiKey = agentWithAgency.agencies?.retell_api_key;

        if (!apiKey) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Fetch all versions of this agent from Retell
        const versions = await getRetellAgentVersions(apiKey, agent.external_id);

        // Separate draft and published
        const published = versions.find(v => v.is_published);
        const draft = versions.find(v => !v.is_published);

        const hasTranscriptUpdated = (events?: string[]) =>
            events?.includes('transcript_updated') ?? false;

        return NextResponse.json({
            agent_name: agent.name,
            external_id: agent.external_id,
            required_events: REQUIRED_WEBHOOK_EVENTS,
            published_version: published ? {
                version: published.version,
                webhook_url: published.webhook_url || null,
                webhook_events: published.webhook_events || [],
                has_transcript_updated: hasTranscriptUpdated(published.webhook_events),
                is_published: true,
            } : null,
            draft_version: draft ? {
                version: draft.version,
                webhook_url: draft.webhook_url || null,
                webhook_events: draft.webhook_events || [],
                has_transcript_updated: hasTranscriptUpdated(draft.webhook_events),
                is_published: false,
            } : null,
            total_versions: versions.length,
            diagnosis: !published
                ? 'NO PUBLISHED VERSION — agent has never been published'
                : !hasTranscriptUpdated(published.webhook_events)
                    ? 'PUBLISHED VERSION MISSING transcript_updated — run Sync to fix'
                    : !published.webhook_url
                        ? 'PUBLISHED VERSION MISSING webhook_url — run Sync to fix'
                        : 'OK — published version has correct webhook config',
        });
    } catch (error) {
        console.error('Webhook status error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
