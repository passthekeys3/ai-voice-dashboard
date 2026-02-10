import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/calls/[id]/live - Get live call details and transcript
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: callId } = await params;
        const supabase = await createClient();

        // Get agency's Retell API key
        const { data: agency } = await supabase
            .from('agencies')
            .select('retell_api_key')
            .eq('id', user.agency.id)
            .single();

        if (!agency?.retell_api_key) {
            return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 });
        }

        // Fetch call details from Retell
        const retellResponse = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${agency.retell_api_key}`,
            },
        });

        if (!retellResponse.ok) {
            const errorText = await retellResponse.text();
            console.error(`Retell API error (${retellResponse.status}):`, errorText);
            if (retellResponse.status === 404) {
                return NextResponse.json({ error: 'Call not found or has ended' }, { status: 404 });
            }
            return NextResponse.json({ error: 'Failed to fetch call data' }, { status: 500 });
        }

        const call = await retellResponse.json();

        // SECURITY: Verify this call belongs to an agent in the user's agency
        const { data: agent } = await supabase
            .from('agents')
            .select('name')
            .eq('external_id', call.agent_id)
            .eq('agency_id', user.agency.id)
            .single();

        // If no agent found, this call doesn't belong to this user's agency
        if (!agent) {
            return NextResponse.json({ error: 'Call not found' }, { status: 404 });
        }

        const agentName = agent.name;

        // Parse transcript into structured format
        const transcriptLines = parseTranscript(call.transcript || '');

        const liveCall = {
            id: call.call_id,
            agent_id: call.agent_id,
            agent_name: agentName,
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
        };

        return NextResponse.json({ data: liveCall });
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
