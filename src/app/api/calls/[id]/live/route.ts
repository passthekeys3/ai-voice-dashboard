import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveProviderApiKeys, getProviderKey } from '@/lib/providers/resolve-keys';
import { getBlandCall } from '@/lib/providers/bland';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/calls/[id]/live?provider=retell - Get live call details and transcript
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: callId } = await params;
        const providerHint = request.nextUrl.searchParams.get('provider') || 'retell';
        const supabase = await createClient();

        // Try DB lookup first (covers all providers, has live transcript from webhook)
        const { data: callRecord } = await supabase
            .from('calls')
            .select('*, agents!inner(name, agency_id, client_id, external_id)')
            .eq('external_id', callId)
            .single();

        if (callRecord) {
            // Verify ownership
            const agentData = callRecord.agents as unknown as { name: string; agency_id: string; client_id: string | null };
            if (agentData.agency_id !== user.agency.id) {
                return NextResponse.json({ error: 'Call not found' }, { status: 404 });
            }

            const transcriptLines = parseTranscript(callRecord.transcript || '');
            const isActive = callRecord.status === 'in_progress';

            // Extract Vapi-specific live URLs from metadata
            const metadata = callRecord.metadata as Record<string, unknown> | null;

            return NextResponse.json({
                data: {
                    id: callRecord.external_id,
                    agent_id: callRecord.agent_id,
                    agent_name: agentData.name,
                    status: isActive ? 'ongoing' : callRecord.status,
                    started_at: callRecord.started_at,
                    duration_seconds: isActive
                        ? Math.floor((Date.now() - new Date(callRecord.started_at).getTime()) / 1000)
                        : callRecord.duration_seconds,
                    from_number: callRecord.from_number,
                    to_number: callRecord.to_number,
                    direction: callRecord.direction,
                    transcript: transcriptLines,
                    raw_transcript: callRecord.transcript,
                    is_active: isActive,
                    provider: callRecord.provider,
                    listen_url: metadata?.vapi_listen_url || null,
                    control_url: metadata?.vapi_control_url || null,
                },
            });
        }

        // Fallback: call not in DB yet — try provider API directly for metadata.
        // NOTE: We don't know the client_id at this point, so we use the agency key.
        // If the call belongs to a client workspace with a separate key, this fallback
        // may fail. The call will be resolved once the webhook populates the DB record.
        const resolvedKeys = await resolveProviderApiKeys(supabase, user.agency.id);

        if (providerHint === 'retell') {
            const retellKey = getProviderKey(resolvedKeys, 'retell');
            if (!retellKey) {
                return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
            }

            const retellResponse = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${retellKey}`,
                },
            });

            if (!retellResponse.ok) {
                if (retellResponse.status === 404) {
                    return NextResponse.json({ error: 'Call not found or has ended' }, { status: 404 });
                }
                return NextResponse.json({ error: 'Failed to fetch call data' }, { status: 500 });
            }

            const call = await retellResponse.json();

            // Verify ownership via agent
            const { data: agent } = await supabase
                .from('agents')
                .select('name, client_id')
                .eq('external_id', call.agent_id)
                .eq('agency_id', user.agency.id)
                .single();

            if (!agent) {
                return NextResponse.json({ error: 'Call not found' }, { status: 404 });
            }

            // Retell API does NOT return transcript during ongoing calls
            // Transcript will be populated via transcript_updated webhook → DB
            const transcriptLines = parseTranscript(call.transcript || '');

            return NextResponse.json({
                data: {
                    id: call.call_id,
                    agent_id: call.agent_id,
                    agent_name: agent.name,
                    status: call.call_status,
                    started_at: new Date(call.start_timestamp).toISOString(),
                    duration_seconds: call.end_timestamp
                        ? Math.floor((call.end_timestamp - call.start_timestamp) / 1000)
                        : Math.floor((Date.now() - call.start_timestamp) / 1000),
                    from_number: call.from_number,
                    to_number: call.to_number,
                    direction: call.direction || 'outbound',
                    transcript: transcriptLines,
                    raw_transcript: call.transcript,
                    is_active: call.call_status === 'ongoing',
                    provider: 'retell',
                },
            });
        }

        // Fallback: Vapi — fetch from Vapi API
        if (providerHint === 'vapi') {
            const vapiKey = getProviderKey(resolvedKeys, 'vapi');
            if (!vapiKey) {
                return NextResponse.json({ error: 'Vapi API key not configured' }, { status: 400 });
            }

            const vapiResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
                headers: { 'Authorization': `Bearer ${vapiKey}` },
            });

            if (!vapiResponse.ok) {
                if (vapiResponse.status === 404) {
                    return NextResponse.json({ error: 'Call not found or has ended' }, { status: 404 });
                }
                return NextResponse.json({ error: 'Failed to fetch call data' }, { status: 500 });
            }

            const vapiCall = await vapiResponse.json();

            // Verify ownership via agent
            const { data: agent } = await supabase
                .from('agents')
                .select('name, client_id')
                .eq('external_id', vapiCall.assistantId)
                .eq('agency_id', user.agency.id)
                .single();

            if (!agent) {
                return NextResponse.json({ error: 'Call not found' }, { status: 404 });
            }

            const isActive = vapiCall.status === 'in-progress' || vapiCall.status === 'queued';
            const transcriptLines = parseTranscript(vapiCall.transcript || '');

            return NextResponse.json({
                data: {
                    id: vapiCall.id,
                    agent_id: vapiCall.assistantId,
                    agent_name: agent.name,
                    status: isActive ? 'ongoing' : vapiCall.status,
                    started_at: vapiCall.startedAt || new Date().toISOString(),
                    duration_seconds: isActive && vapiCall.startedAt
                        ? Math.floor((Date.now() - new Date(vapiCall.startedAt).getTime()) / 1000)
                        : 0,
                    from_number: vapiCall.customer?.number,
                    to_number: vapiCall.phoneNumber?.number,
                    direction: vapiCall.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
                    transcript: transcriptLines,
                    raw_transcript: vapiCall.transcript,
                    is_active: isActive,
                    provider: 'vapi',
                },
            });
        }

        // Fallback: Bland — fetch from Bland API
        if (providerHint === 'bland') {
            const blandKey = getProviderKey(resolvedKeys, 'bland');
            if (!blandKey) {
                return NextResponse.json({ error: 'Bland API key not configured' }, { status: 400 });
            }

            try {
                const blandCall = await getBlandCall(blandKey, callId);

                // Verify ownership via pathway → agent
                const agentExternalId = blandCall.pathway_id;
                if (!agentExternalId) {
                    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
                }

                const { data: agent } = await supabase
                    .from('agents')
                    .select('name, client_id')
                    .eq('external_id', agentExternalId)
                    .eq('agency_id', user.agency.id)
                    .single();

                if (!agent) {
                    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
                }

                const isActive = !blandCall.completed && blandCall.status !== 'completed' && blandCall.status !== 'error';
                const durationSeconds = blandCall.call_length
                    ? Math.round(blandCall.call_length * 60)
                    : (blandCall.started_at
                        ? Math.floor((Date.now() - new Date(blandCall.started_at).getTime()) / 1000)
                        : 0);

                // Use structured transcripts if available
                let transcriptText = '';
                if (blandCall.transcripts && blandCall.transcripts.length > 0) {
                    transcriptText = blandCall.transcripts
                        .map(t => `${t.user === 'assistant' ? 'Agent' : 'User'}: ${t.text}`)
                        .join('\n');
                } else {
                    transcriptText = blandCall.concatenated_transcript || '';
                }

                const transcriptLines = parseTranscript(transcriptText);

                return NextResponse.json({
                    data: {
                        id: blandCall.call_id,
                        agent_id: agentExternalId,
                        agent_name: agent.name,
                        status: isActive ? 'ongoing' : (blandCall.status === 'error' ? 'failed' : blandCall.status),
                        started_at: blandCall.started_at || blandCall.created_at,
                        duration_seconds: durationSeconds,
                        from_number: blandCall.from,
                        to_number: blandCall.to,
                        direction: (blandCall.metadata?.direction === 'inbound') ? 'inbound' : 'outbound',
                        transcript: transcriptLines,
                        raw_transcript: transcriptText,
                        is_active: isActive,
                        provider: 'bland',
                    },
                });
            } catch (err) {
                console.error('Error fetching Bland call:', err instanceof Error ? err.message : 'Unknown error');
                if ((err as Error).message?.includes('404')) {
                    return NextResponse.json({ error: 'Call not found or has ended' }, { status: 404 });
                }
                return NextResponse.json({ error: 'Failed to fetch call data' }, { status: 500 });
            }
        }

        return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    } catch (error) {
        console.error('Error fetching live call:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Parse Retell transcript format into structured lines
function parseTranscript(transcript: string): { speaker: 'agent' | 'user'; text: string }[] {
    if (!transcript) return [];

    const lines: { speaker: 'agent' | 'user'; text: string }[] = [];

    // Retell format: "Agent: Hello...\nUser: Hi...\n"
    const parts = transcript.split('\n').filter(line => line.trim());

    for (const part of parts) {
        if (part.startsWith('Agent:')) {
            lines.push({ speaker: 'agent', text: part.replace('Agent:', '').trim() });
        } else if (part.startsWith('User:')) {
            lines.push({ speaker: 'user', text: part.replace('User:', '').trim() });
        } else if (lines.length > 0) {
            // Continuation of previous line
            lines[lines.length - 1].text += ' ' + part.trim();
        }
    }

    return lines;
}
