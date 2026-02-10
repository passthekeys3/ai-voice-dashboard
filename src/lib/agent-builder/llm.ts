/**
 * AI Agent Builder - LLM Integration
 *
 * Handles Claude API calls for agent configuration generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import { BUILDER_SYSTEM_PROMPT, buildMessages } from './prompts';
import type { LLMBuilderResponse, Voice, VoiceCharacteristics, VoiceRecommendation } from './types';

// --- Configuration constants ---
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_OUTPUT_TOKENS = 4096;
const TOP_VOICES_COUNT = 3;

// Voice scoring weights
const SCORE_GENDER = 40;
const SCORE_ACCENT = 30;
const SCORE_AGE = 20;
const SCORE_PREVIEW = 5;

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

/**
 * Generate agent configuration via Claude (streaming)
 * Returns a ReadableStream that sends newline-delimited JSON chunks
 */
export async function generateAgentConfigStream(
    history: { role: 'user' | 'assistant'; content: string }[],
    currentMessage: string,
    draft: { name: string; systemPrompt: string; firstMessage: string } | null,
    context: { hasGHL: boolean; hasHubSpot: boolean; hasGCal?: boolean; hasCalendly?: boolean; hasSlack?: boolean }
): Promise<ReadableStream<Uint8Array>> {
    const client = getClient();
    const messages = buildMessages(history, currentMessage, draft, context);

    const stream = await client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: BUILDER_SYSTEM_PROMPT,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
        })),
    });

    const encoder = new TextEncoder();
    let fullText = '';

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const event of stream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        fullText += event.delta.text;
                        // Stream text chunks for real-time display
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({ type: 'text_delta', text: event.delta.text }) + '\n'
                            )
                        );
                    }
                }

                // Parse the complete response as JSON
                const parsed = parseBuilderResponse(fullText);

                // Send final structured result
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({ type: 'result', data: parsed }) + '\n'
                    )
                );

                controller.close();
            } catch (error) {
                const errorMessage = error instanceof APIError
                    ? getAPIErrorMessage(error)
                    : 'Failed to generate response';

                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({ type: 'error', error: errorMessage }) + '\n'
                    )
                );
                controller.close();
            }
        },
    });
}

/**
 * Parse Claude's response text into structured LLMBuilderResponse
 */
function parseBuilderResponse(text: string): LLMBuilderResponse {
    // Try to parse as JSON directly
    try {
        const trimmed = text.trim();
        // Handle markdown code blocks
        const jsonStr = trimmed.startsWith('```')
            ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
            : trimmed;
        return JSON.parse(jsonStr);
    } catch {
        // If JSON parse fails, return the text as a plain message
        return {
            message: text,
            updates: undefined,
        };
    }
}

/**
 * Map user-friendly error messages for API errors
 */
function getAPIErrorMessage(error: APIError): string {
    if (error.status === 401) return 'AI service authentication failed. Check your API key.';
    if (error.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (error.status === 529) return 'AI service is temporarily overloaded. Please try again.';
    return 'Failed to generate response. Please try again.';
}

/**
 * Score and match voices to desired characteristics
 */
export function matchVoicesToDescription(
    characteristics: VoiceCharacteristics,
    voices: Voice[]
): VoiceRecommendation[] {
    const scored = voices.map(voice => {
        let score = 0;
        const reasons: string[] = [];

        // Gender match (highest weight)
        if (characteristics.gender && voice.gender) {
            if (voice.gender.toLowerCase() === characteristics.gender.toLowerCase()) {
                score += SCORE_GENDER;
                reasons.push(`${voice.gender} voice as requested`);
            }
        }

        // Accent match
        if (characteristics.accent && voice.accent) {
            if (voice.accent.toLowerCase().includes(characteristics.accent.toLowerCase())) {
                score += SCORE_ACCENT;
                reasons.push(`${voice.accent} accent`);
            }
        }

        // Age range match
        if (characteristics.ageRange && voice.age) {
            const ageMap: Record<string, string[]> = {
                'young': ['young', '20s', 'youthful'],
                'middle-aged': ['middle', '30s', '40s', 'adult'],
                'mature': ['mature', '50s', 'senior', 'older'],
            };
            const ageTerms = ageMap[characteristics.ageRange] || [];
            if (ageTerms.some(term => voice.age?.toLowerCase().includes(term))) {
                score += SCORE_AGE;
                reasons.push(`${voice.age} voice matches ${characteristics.ageRange} preference`);
            }
        }

        // Small bonus for having a preview URL (useful for user)
        if (voice.preview_url) {
            score += SCORE_PREVIEW;
        }

        return {
            voice_id: voice.id,
            name: voice.name,
            gender: voice.gender,
            accent: voice.accent,
            age: voice.age,
            preview_url: voice.preview_url,
            reasoning: reasons.length > 0 ? reasons.join(', ') : 'General match',
            score,
        };
    });

    // Sort by score descending and return top matches
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_VOICES_COUNT);
}
