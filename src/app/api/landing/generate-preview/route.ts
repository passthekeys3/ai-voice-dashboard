import { NextRequest, NextResponse } from 'next/server';
import { generateAgentConfigStream } from '@/lib/agent-builder/llm';
import { checkRateLimitAsync, getRateLimitKey } from '@/lib/rate-limit';

// Aggressive rate limit for public endpoint: 3 per hour per IP
const PREVIEW_RATE_LIMIT = {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
};

const MAX_PROMPT_LENGTH = 500;

// POST /api/landing/generate-preview — Public agent builder preview (no auth)
export async function POST(request: NextRequest) {
    try {
        // Rate limit by IP
        const ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const key = getRateLimitKey(ip, '/api/landing/generate-preview');
        const rateResult = await checkRateLimitAsync(key, PREVIEW_RATE_LIMIT);

        if (!rateResult.allowed) {
            return NextResponse.json(
                {
                    error: 'Preview limit reached. Sign up for unlimited access.',
                    remaining: 0,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': Math.ceil(
                            (rateResult.resetTime - Date.now()) / 1000
                        ).toString(),
                        'X-RateLimit-Remaining': '0',
                    },
                }
            );
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
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }

        if (!body?.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        const prompt = body.prompt.trim().slice(0, MAX_PROMPT_LENGTH);

        // Call the shared LLM function with:
        // - No history (fresh, single-prompt generation)
        // - No draft context
        // - No integrations (public visitor has nothing connected)
        const stream = await generateAgentConfigStream(
            [],    // No history
            prompt,
            null,  // No draft
            {
                hasGHL: false,
                hasHubSpot: false,
                hasGCal: false,
                hasCalendly: false,
                hasSlack: false,
            }
        );

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
                'Connection': 'keep-alive',
                'X-RateLimit-Remaining': rateResult.remaining.toString(),
            },
        });
    } catch (error) {
        console.error(
            'Landing preview error:',
            error instanceof Error ? error.message : 'Unknown error'
        );
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        );
    }
}
