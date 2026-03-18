/**
 * AI Agent Builder - LLM Integration
 *
 * Handles Claude API calls for agent configuration generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import { BUILDER_SYSTEM_PROMPT, buildMessages } from './prompts';
import { MAX_PROMPT_LENGTH } from '@/lib/constants/config';
import type { LLMBuilderResponse, Voice, VoiceCharacteristics, VoiceRecommendation } from './types';

// --- Configuration constants ---
const CLAUDE_MODEL = 'claude-sonnet-4-6';
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
                // Log full error details for debugging (visible in Vercel logs)
                if (error instanceof APIError) {
                    console.error(`Agent builder Claude API error: status=${error.status} message=${error.message}`);
                } else {
                    console.error('Agent builder stream error:', error instanceof Error ? error.message : error);
                }

                const errorMessage = error instanceof APIError
                    ? getAPIErrorMessage(error)
                    : error instanceof Error
                        ? error.message
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
 * Parse Claude's response text into structured LLMBuilderResponse.
 * Validates the shape so unexpected LLM output never propagates raw.
 */
function parseBuilderResponse(text: string): LLMBuilderResponse {
    // Try to parse as JSON directly
    try {
        const trimmed = text.trim();
        // Handle markdown code blocks
        const jsonStr = trimmed.startsWith('```')
            ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
            : trimmed;
        const raw = JSON.parse(jsonStr);
        return sanitizeLLMResponse(raw);
    } catch {
        // If JSON parse fails, return the text as a plain message
        return {
            message: text,
            updates: undefined,
        };
    }
}

/** Validate and sanitize parsed JSON into a safe LLMBuilderResponse */
function sanitizeLLMResponse(raw: unknown): LLMBuilderResponse {
    if (!raw || typeof raw !== 'object') {
        return { message: String(raw), updates: undefined };
    }

    const obj = raw as Record<string, unknown>;
    const message = typeof obj.message === 'string' ? obj.message : '';

    if (!obj.updates || typeof obj.updates !== 'object') {
        return { message, updates: undefined };
    }

    const rawUpdates = obj.updates as Record<string, unknown>;
    const updates: LLMBuilderResponse['updates'] = {};

    if (typeof rawUpdates.name === 'string') updates.name = rawUpdates.name.slice(0, 200);
    if (typeof rawUpdates.systemPrompt === 'string') updates.systemPrompt = rawUpdates.systemPrompt.slice(0, MAX_PROMPT_LENGTH);
    if (typeof rawUpdates.firstMessage === 'string') updates.firstMessage = rawUpdates.firstMessage.slice(0, 1000);
    if (typeof rawUpdates.language === 'string') updates.language = rawUpdates.language.slice(0, 10);

    if (rawUpdates.voiceCharacteristics && typeof rawUpdates.voiceCharacteristics === 'object') {
        const voiceChars = rawUpdates.voiceCharacteristics as Record<string, unknown>;
        updates.voiceCharacteristics = {
            ...(typeof voiceChars.gender === 'string' && ['male', 'female', 'neutral'].includes(voiceChars.gender) ? { gender: voiceChars.gender as 'male' | 'female' | 'neutral' } : {}),
            ...(typeof voiceChars.ageRange === 'string' && ['young', 'middle-aged', 'mature'].includes(voiceChars.ageRange) ? { ageRange: voiceChars.ageRange as 'young' | 'middle-aged' | 'mature' } : {}),
            ...(typeof voiceChars.accent === 'string' ? { accent: voiceChars.accent.slice(0, 50) } : {}),
            ...(typeof voiceChars.tone === 'string' ? { tone: voiceChars.tone.slice(0, 100) } : {}),
        };
    }

    if (Array.isArray(rawUpdates.integrationSuggestions)) {
        updates.integrationSuggestions = rawUpdates.integrationSuggestions
            .filter((s): s is string => typeof s === 'string')
            .slice(0, 20);
    }

    return { message, updates: Object.keys(updates).length > 0 ? updates : undefined };
}

/**
 * Map user-friendly error messages for API errors
 */
function getAPIErrorMessage(error: APIError): string {
    if (error.status === 401) return 'AI service authentication failed. Check your API key.';
    if (error.status === 400) return 'AI service rejected the request. The model or parameters may be invalid.';
    if (error.status === 404) return 'AI model not found. The model ID may need updating.';
    if (error.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (error.status === 529) return 'AI service is temporarily overloaded. Please try again.';
    return `AI service error (${error.status}). Please try again.`;
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
