import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { generateWorkflowStream } from '@/lib/workflows/ai-builder';

const MAX_MESSAGE_LENGTH = 5000;

// POST /api/workflows/generate - Stream workflow generation via Claude
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return NextResponse.json(
                { error: 'AI service not configured' },
                { status: 503 }
            );
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { message, context, agents } = body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `Message must be under ${MAX_MESSAGE_LENGTH} characters` },
                { status: 400 }
            );
        }

        const safeContext = {
            hasGHL: !!(context?.hasGHL),
            hasHubSpot: !!(context?.hasHubSpot),
            hasGCal: !!(context?.hasGCal),
            hasCalendly: !!(context?.hasCalendly),
            hasSlack: !!(context?.hasSlack),
        };

        const safeAgents = Array.isArray(agents)
            ? agents
                .filter((a: { id?: string; name?: string }) => a && typeof a.id === 'string' && typeof a.name === 'string')
                .slice(0, 50)
                .map((a: { id: string; name: string }) => ({
                    id: a.id,
                    name: a.name.slice(0, 200),
                }))
            : [];

        const stream = await generateWorkflowStream(
            message.trim(),
            safeContext,
            safeAgents
        );

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error in workflow generate:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
