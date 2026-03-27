import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/server';
import { getRetellAgent } from '@/lib/providers/retell';
import { safeParseJson } from '@/lib/validation';

/**
 * POST /api/admin/agents/assign
 *
 * Assigns a platform Retell agent to a specific agency (and optionally client).
 * If the agent is already assigned to a different agency, the old assignment is removed first.
 * Platform admin only.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isPlatformAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;

        const { external_id, agency_id, client_id } = bodyOrError;

        if (!external_id || typeof external_id !== 'string') {
            return NextResponse.json({ error: 'external_id is required and must be a string' }, { status: 400 });
        }
        if (!agency_id || typeof agency_id !== 'string') {
            return NextResponse.json({ error: 'agency_id is required and must be a string' }, { status: 400 });
        }
        if (client_id && typeof client_id !== 'string') {
            return NextResponse.json({ error: 'client_id must be a string' }, { status: 400 });
        }

        const platformKey = process.env.PLATFORM_RETELL_API_KEY;
        if (!platformKey) {
            return NextResponse.json(
                { error: 'PLATFORM_RETELL_API_KEY is not configured' },
                { status: 400 }
            );
        }

        const supabase = createServiceClient();

        // Verify agency exists
        const { data: agency } = await supabase
            .from('agencies')
            .select('id, name')
            .eq('id', agency_id)
            .single();

        if (!agency) {
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
        }

        // Verify client belongs to agency if provided
        if (client_id) {
            const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('id', client_id)
                .eq('agency_id', agency_id)
                .single();

            if (!client) {
                return NextResponse.json({ error: 'Client not found in this agency' }, { status: 404 });
            }
        }

        // Fetch agent details from Retell
        const retellAgent = await getRetellAgent(platformKey, external_id);

        // Remove any existing platform assignment for this agent (prevents duplicates across agencies)
        await supabase
            .from('agents')
            .delete()
            .eq('external_id', retellAgent.agent_id)
            .eq('provider', 'retell')
            .filter('config->>key_source', 'eq', 'platform');

        // Insert the new assignment
        const { error: insertError } = await supabase
            .from('agents')
            .insert({
                agency_id,
                client_id: client_id || null,
                name: retellAgent.agent_name,
                provider: 'retell' as const,
                external_id: retellAgent.agent_id,
                config: {
                    voice_id: retellAgent.voice_id,
                    language: retellAgent.language,
                    key_source: 'platform',
                },
            });

        if (insertError) {
            console.error('[ADMIN] Agent assign insert error:', insertError.code);
            return NextResponse.json({ error: 'Failed to assign agent' }, { status: 500 });
        }

        return NextResponse.json({
            message: `Agent "${retellAgent.agent_name}" assigned to ${agency.name}`,
        });
    } catch (error) {
        console.error('[ADMIN] Agent assign error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/agents/assign
 *
 * Unassigns a platform agent from an agency.
 * Only deletes agents with key_source: 'platform' to protect agency-owned agents.
 */
export async function DELETE(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isPlatformAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const bodyOrError = await safeParseJson(request);
        if (bodyOrError instanceof NextResponse) return bodyOrError;

        const { external_id, agency_id } = bodyOrError;

        if (!external_id || typeof external_id !== 'string') {
            return NextResponse.json({ error: 'external_id is required and must be a string' }, { status: 400 });
        }
        if (!agency_id || typeof agency_id !== 'string') {
            return NextResponse.json({ error: 'agency_id is required and must be a string' }, { status: 400 });
        }

        const supabase = createServiceClient();

        const { data: deleted } = await supabase
            .from('agents')
            .delete()
            .eq('external_id', external_id)
            .eq('agency_id', agency_id)
            .eq('provider', 'retell')
            .filter('config->>key_source', 'eq', 'platform')
            .select('id');

        if (!deleted || deleted.length === 0) {
            return NextResponse.json({ error: 'Platform agent not found for this agency' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Agent unassigned' });
    } catch (error) {
        console.error('[ADMIN] Agent unassign error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
