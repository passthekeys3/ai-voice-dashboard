import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const MIN_CALLS_FOR_SUGGESTIONS = 5;
const MAX_CALLS_TO_ANALYZE = 20;
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
    if (!anthropicClient) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }
        anthropicClient = new Anthropic({ apiKey });
    }
    return anthropicClient;
}

interface CachedSuggestions {
    suggestions: { title: string; description: string; priority: string }[];
    generated_at: string;
}

// GET /api/agents/[id]/suggestions - Get AI prompt improvement suggestions (cached 6 hours)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        const supabase = await createClient();

        // Verify agent belongs to this agency
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, config')
            .eq('id', id)
            .eq('agency_id', user.agency.id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        const agentConfig = agent.config as Record<string, unknown>;
        const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

        // Check cache (stored in agent config JSONB)
        const cached = agentConfig?._cached_suggestions as CachedSuggestions | undefined;
        if (cached?.generated_at && !forceRefresh) {
            const cacheAge = Date.now() - new Date(cached.generated_at).getTime();
            if (cacheAge < CACHE_DURATION_MS && cached.suggestions?.length > 0) {
                return NextResponse.json({
                    data: {
                        suggestions: cached.suggestions,
                        generated_at: cached.generated_at,
                    },
                });
            }
        }

        // Fetch recent completed calls
        const { data: calls } = await supabase
            .from('calls')
            .select('summary, sentiment, duration_seconds, call_score, topics, objections, metadata')
            .eq('agent_id', id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(MAX_CALLS_TO_ANALYZE);

        if (!calls || calls.length < MIN_CALLS_FOR_SUGGESTIONS) {
            return NextResponse.json({
                data: {
                    suggestions: [],
                    reason: `Need at least ${MIN_CALLS_FOR_SUGGESTIONS} completed calls to generate suggestions. Currently have ${calls?.length || 0}.`,
                },
            });
        }

        // Build call data summary for Claude
        const callSummaries = calls.map((c, i) => {
            const parts = [`Call ${i + 1}:`];
            if (c.sentiment) parts.push(`Sentiment: ${c.sentiment}`);
            if (c.duration_seconds) parts.push(`Duration: ${c.duration_seconds}s`);
            if (c.call_score != null) parts.push(`Score: ${c.call_score}/100`);
            if (c.summary) parts.push(`Summary: ${c.summary}`);
            if (c.topics && Array.isArray(c.topics) && c.topics.length > 0) {
                parts.push(`Topics: ${(c.topics as string[]).join(', ')}`);
            }
            if (c.objections && Array.isArray(c.objections) && c.objections.length > 0) {
                parts.push(`Objections: ${(c.objections as string[]).join(', ')}`);
            }
            const aiAnalysis = (c.metadata as Record<string, unknown>)?.ai_analysis as Record<string, unknown> | undefined;
            if (aiAnalysis?.call_outcome) {
                parts.push(`Outcome: ${aiAnalysis.call_outcome}`);
            }
            return parts.join(' | ');
        }).join('\n');

        // Get the current system prompt (from config)
        const currentPrompt = agentConfig?.system_prompt
            || agentConfig?.prompt
            || 'No system prompt available';

        const client = getClient();

        const response = await client.messages.create({
            model: 'claude-haiku-4-20250514',
            max_tokens: 1024,
            system: `You are an expert at optimizing AI voice agent prompts. Analyze the agent's recent call data and current system prompt, then provide specific, actionable suggestions to improve performance.

Respond with ONLY valid JSON:
{
  "suggestions": [
    {
      "title": "Short title (under 60 chars)",
      "description": "Specific, actionable suggestion with example text if relevant. 1-2 sentences.",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Provide 3-5 suggestions, ranked by impact
- Focus on patterns in the call data (common objections, sentiment trends, short calls)
- Be specific — don't just say "improve the prompt", say what to add/change
- If calls are mostly positive with high scores, acknowledge that and suggest optimizations
- Look for: common objections to address, missing information handling, tone mismatches, conversation flow issues`,
            messages: [{
                role: 'user',
                content: `Agent: ${agent.name}\n\nCurrent System Prompt:\n${String(currentPrompt).slice(0, 5000)}\n\nRecent Call Data (${calls.length} calls):\n${callSummaries}`,
            }],
        });

        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            return NextResponse.json({
                data: { suggestions: [], reason: 'Failed to generate suggestions' },
            });
        }

        try {
            const parsed = JSON.parse(textBlock.text.trim());
            // Validate structure
            const suggestions = Array.isArray(parsed.suggestions)
                ? parsed.suggestions
                    .filter((s: Record<string, unknown>) => s.title && s.description && s.priority)
                    .slice(0, 5)
                    .map((s: Record<string, unknown>) => ({
                        title: String(s.title).slice(0, 100),
                        description: String(s.description).slice(0, 300),
                        priority: ['high', 'medium', 'low'].includes(String(s.priority)) ? s.priority : 'medium',
                    }))
                : [];

            const generatedAt = new Date().toISOString();

            // Cache suggestions in agent config (merge, don't overwrite other fields)
            if (suggestions.length > 0) {
                await supabase
                    .from('agents')
                    .update({
                        config: {
                            ...agentConfig,
                            _cached_suggestions: {
                                suggestions,
                                generated_at: generatedAt,
                            },
                        },
                    })
                    .eq('id', id);
            }

            return NextResponse.json({
                data: {
                    suggestions,
                    generated_at: generatedAt,
                },
            });
        } catch {
            return NextResponse.json({
                data: { suggestions: [], reason: 'Failed to parse suggestions' },
            });
        }
    } catch (error) {
        console.error('Error generating suggestions:', error instanceof Error ? error.message : error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
