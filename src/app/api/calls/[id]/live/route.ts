import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

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
            .select('*, agents!inner(name, agency_id, external_id)')
            .eq('external_id', callId)
            .single();

        if (callRecord) {
            // Verify ownership
            const agentData = callRecord.agents as unknown as { name: string; agency_id: string };
            if (agentData.agency_id !== user.agency.id) {
                return NextResponse.json({ error: 'Call not found' }, { status: 404 });
            }

            const transcriptLines = parseTranscript(callRecord.transcript || '');
            const isActive = callRecord.status === 'in_progress';

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
                },
            });
        }

        // Fallback: call not in DB yet — try provider API directly for metadata
        if (providerHint === 'retell') {
            const { data: agency } = await supabase
                .from('agencies')
                .select('retell_api_key')
                .eq('id', user.agency.id)
                .single();

            if (!agency?.retell_api_key) {
                return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
            }

            const retellResponse = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${agency.retell_api_key}`,
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
                .select('name')
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

        return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    } catch (error) {
        console.error('Error fetching live call:', error);
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
