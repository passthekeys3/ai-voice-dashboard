/**
 * AI Call Analysis
 *
 * Uses Claude Haiku to analyze call transcripts and extract structured insights:
 * sentiment, topics, objections, action items, lead score, and outcome.
 *
 * Runs as a background task (via waitUntil) after completed calls.
 * Never blocks webhook response — gracefully handles all errors.
 */

import Anthropic from '@anthropic-ai/sdk';

// Use Haiku for cost efficiency — transcripts can be long
const CLAUDE_MODEL = 'claude-haiku-4-20250514';
const MAX_TRANSCRIPT_CHARS = 30000; // ~7.5k tokens
const MAX_OUTPUT_TOKENS = 512;      // Actual responses are ~200 tokens; reduced from 1024
const ANALYSIS_TIMEOUT_MS = 30000;  // 30 seconds

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

export interface CallAnalysis {
    sentiment: 'positive' | 'neutral' | 'negative';
    sentiment_score: number;   // 0-100
    topics: string[];          // max 5
    objections: string[];      // max 5
    action_items: string[];    // max 5
    summary: string;           // 2-3 sentence summary
    lead_score: number;        // 0-100
    call_outcome: string;      // categorized outcome
}

/**
 * Smart gating function — determines if a call should be AI-analyzed.
 * Returns false if analysis is disabled, or call is too short/sparse.
 */
export function shouldAnalyzeCall(
    aiEnabled: boolean,
    durationSec: number,
    transcriptLen: number,
): boolean {
    if (!aiEnabled) return false;
    if (durationSec < 30) return false;        // Dropped/spam calls
    if (transcriptLen < 100) return false;      // Too short to be useful
    return true;
}

const VALID_OUTCOMES = new Set([
    'appointment_booked', 'info_requested', 'objection_raised',
    'callback_requested', 'sale_completed', 'no_outcome',
]);

const SYSTEM_PROMPT = `You are an expert call analyst. Analyze the following call transcript and extract structured insights.

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentiment_score": <number 0-100, where 0=very negative, 50=neutral, 100=very positive>,
  "topics": ["topic1", "topic2"],
  "objections": ["objection1"],
  "action_items": ["action1"],
  "summary": "2-3 sentence summary of the call",
  "lead_score": <number 0-100, likelihood of conversion>,
  "call_outcome": "appointment_booked" | "info_requested" | "objection_raised" | "callback_requested" | "sale_completed" | "no_outcome"
}

Rules:
- topics: Max 5 short phrases describing key topics discussed
- objections: Max 5 objections or concerns the caller raised (empty array if none)
- action_items: Max 5 follow-up actions identified (empty array if none)
- summary: Concise 2-3 sentence summary focusing on outcome and key points
- lead_score: Based on engagement level, interest signals, questions asked, and outcome
- call_outcome: Pick the single best match from the allowed values
- If the transcript is very short or unclear, do your best with available info`;

/**
 * Analyze a call transcript using Claude Haiku.
 * Returns null if transcript is too short or analysis fails.
 */
export async function analyzeCallTranscript(
    transcript: string,
    agentName?: string,
): Promise<CallAnalysis | null> {
    // Skip very short transcripts
    if (!transcript || transcript.trim().length < 50) {
        return null;
    }

    // Don't analyze if API key is missing
    if (!process.env.ANTHROPIC_API_KEY) {
        return null;
    }

    try {
        const client = getClient();

        // Truncate very long transcripts
        const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
            ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transcript truncated due to length]'
            : transcript;

        const userPrompt = agentName
            ? `AI Agent: ${agentName}\n\nTranscript:\n${truncatedTranscript}`
            : `Transcript:\n${truncatedTranscript}`;

        const response = await Promise.race([
            client.messages.create({
                model: CLAUDE_MODEL,
                max_tokens: MAX_OUTPUT_TOKENS,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }],
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Analysis timeout')), ANALYSIS_TIMEOUT_MS)
            ),
        ]);

        // Extract text from response
        const textBlock = response.content.find(block => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            return null;
        }

        const parsed = parseAnalysisResponse(textBlock.text);
        return parsed;
    } catch (error) {
        // Never throw — this is a background enrichment task
        console.error('Call analysis failed:', error instanceof Error ? error.message : error);
        return null;
    }
}

/**
 * Parse and validate the analysis response
 */
function parseAnalysisResponse(text: string): CallAnalysis | null {
    try {
        const trimmed = text.trim();
        const jsonStr = trimmed.startsWith('```')
            ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
            : trimmed;

        const raw = JSON.parse(jsonStr);

        // Validate and sanitize
        const sentiment = ['positive', 'neutral', 'negative'].includes(raw.sentiment)
            ? raw.sentiment
            : 'neutral';

        const sentimentScore = typeof raw.sentiment_score === 'number'
            ? Math.max(0, Math.min(100, Math.round(raw.sentiment_score)))
            : 50;

        const topics = Array.isArray(raw.topics)
            ? raw.topics.filter((t: unknown) => typeof t === 'string').slice(0, 5) as string[]
            : [];

        const objections = Array.isArray(raw.objections)
            ? raw.objections.filter((o: unknown) => typeof o === 'string').slice(0, 5) as string[]
            : [];

        const actionItems = Array.isArray(raw.action_items)
            ? raw.action_items.filter((a: unknown) => typeof a === 'string').slice(0, 5) as string[]
            : [];

        const summary = typeof raw.summary === 'string'
            ? raw.summary.slice(0, 500)
            : '';

        const leadScore = typeof raw.lead_score === 'number'
            ? Math.max(0, Math.min(100, Math.round(raw.lead_score)))
            : 0;

        const callOutcome = VALID_OUTCOMES.has(raw.call_outcome)
            ? raw.call_outcome
            : 'no_outcome';

        return {
            sentiment,
            sentiment_score: sentimentScore,
            topics,
            objections,
            action_items: actionItems,
            summary,
            lead_score: leadScore,
            call_outcome: callOutcome,
        };
    } catch {
        return null;
    }
}
