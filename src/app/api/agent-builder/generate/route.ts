import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { generateAgentConfigStream } from '@/lib/agent-builder/llm';

const MAX_MESSAGE_LENGTH = 5000;
const MAX_HISTORY_MESSAGES = 50;
const MAX_HISTORY_CONTENT_LENGTH = 10000;

// POST /api/agent-builder/generate - Stream agent config generation via Claude
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

        const { message, history, draft, context } = body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // Input length limits
        if (message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `Message must be under ${MAX_MESSAGE_LENGTH} characters` },
                { status: 400 }
            );
        }

        // Validate and limit history
        const safeHistory = Array.isArray(history)
            ? history
                .filter(
                    (m: { role?: string; content?: string }) =>
                        m &&
                        typeof m.role === 'string' &&
                        typeof m.content === 'string' &&
                        (m.role === 'user' || m.role === 'assistant')
                )
                .slice(0, MAX_HISTORY_MESSAGES)
                .map((m: { role: string; content: string }) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
                }))
            : [];

        const safeDraft = draft && typeof draft === 'object'
            ? {
                name: typeof draft.name === 'string' ? draft.name.slice(0, 200) : '',
                systemPrompt: typeof draft.systemPrompt === 'string' ? draft.systemPrompt.slice(0, 50000) : '',
                firstMessage: typeof draft.firstMessage === 'string' ? draft.firstMessage.slice(0, 1000) : '',
            }
            : null;

        const safeContext = {
            hasGHL: !!(context?.hasGHL),
            hasHubSpot: !!(context?.hasHubSpot),
            hasGCal: !!(context?.hasGCal),
            hasCalendly: !!(context?.hasCalendly),
            hasSlack: !!(context?.hasSlack),
        };

        const stream = await generateAgentConfigStream(
            safeHistory,
            message.trim(),
            safeDraft,
            safeContext
        );

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error in agent-builder generate:', error instanceof Error ? error.message : error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
