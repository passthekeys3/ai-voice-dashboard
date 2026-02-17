/**
 * Test Conversation Evaluator
 *
 * Uses Claude Sonnet to evaluate a simulated conversation against success criteria.
 * Returns per-criterion pass/fail with reasoning, overall score, and summary.
 * Follows the call-analyzer.ts JSON-output pattern.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TranscriptMessage, SuccessCriterion, CriterionResult } from '@/types';

const CLAUDE_MODEL = 'claude-sonnet-4-6-20250514';
const MAX_EVAL_TOKENS = 1024;

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

export interface EvaluationResult {
    criteriaResults: CriterionResult[];
    overallScore: number;
    evaluationSummary: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    topics: string[];
    inputTokens: number;
    outputTokens: number;
}

const EVALUATION_SYSTEM_PROMPT = `You are an expert QA evaluator for voice AI agents. Analyze this simulated conversation and evaluate each success criterion.

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
    "criteria_results": [
        {
            "criterion": "exact text from input",
            "type": "must_pass|should_pass|must_not_fail",
            "passed": true,
            "reasoning": "1-2 sentence explanation"
        }
    ],
    "overall_score": 75,
    "evaluation_summary": "2-3 sentence summary of agent performance",
    "sentiment": "positive|neutral|negative",
    "topics": ["topic1", "topic2"]
}

Scoring rules:
- Start at 70 (baseline for a functioning agent)
- Each must_pass failure: -15 points
- Each must_not_fail violation: -25 points
- Each should_pass success: +5 points
- Bonus for natural, empathetic conversation: up to +10
- Penalty for robotic, repetitive responses: up to -10
- Clamp final score to 0-100`;

export async function evaluateConversation(params: {
    transcript: TranscriptMessage[];
    successCriteria: SuccessCriterion[];
    scenario: string;
    agentSystemPrompt: string;
}): Promise<EvaluationResult | null> {
    const { transcript, successCriteria, scenario, agentSystemPrompt } = params;

    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('Evaluator: ANTHROPIC_API_KEY not set — skipping evaluation');
        return null;
    }

    if (successCriteria.length === 0) {
        return null;
    }

    try {
        const client = getClient();

        // Format transcript for evaluation
        const transcriptText = transcript
            .map(m => `${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.content}`)
            .join('\n');

        const criteriaList = successCriteria
            .map(c => `- [${c.type}] ${c.criterion}`)
            .join('\n');

        const userPrompt = `Agent's system prompt (first 3000 chars):
${agentSystemPrompt.slice(0, 3000)}

Test scenario:
${scenario}

Success criteria to evaluate:
${criteriaList}

Simulated conversation:
${transcriptText}`;

        const response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: MAX_EVAL_TOKENS,
            system: EVALUATION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
        });

        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            return null;
        }

        const parsed = parseEvaluationResponse(textBlock.text, successCriteria);
        if (!parsed) return null;

        return {
            ...parsed,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        };
    } catch (error) {
        console.error('Evaluation failed:', error instanceof Error ? error.message : error);
        return null;
    }
}

function parseEvaluationResponse(
    text: string,
    expectedCriteria: SuccessCriterion[],
): Omit<EvaluationResult, 'inputTokens' | 'outputTokens'> | null {
    try {
        const trimmed = text.trim();
        const jsonStr = trimmed.startsWith('```')
            ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
            : trimmed;

        const raw = JSON.parse(jsonStr);

        // Parse criteria results
        const criteriaResults: CriterionResult[] = [];
        if (Array.isArray(raw.criteria_results)) {
            for (const cr of raw.criteria_results) {
                if (!cr.criterion || typeof cr.passed !== 'boolean') continue;
                criteriaResults.push({
                    criterion: String(cr.criterion).slice(0, 500),
                    type: ['must_pass', 'should_pass', 'must_not_fail'].includes(cr.type) ? cr.type : 'must_pass',
                    passed: cr.passed,
                    reasoning: String(cr.reasoning || '').slice(0, 500),
                });
            }
        }

        // If LLM missed some criteria, add them as unevaluated
        for (const expected of expectedCriteria) {
            const found = criteriaResults.find(cr =>
                cr.criterion.toLowerCase().includes(expected.criterion.toLowerCase().slice(0, 30))
            );
            if (!found) {
                criteriaResults.push({
                    criterion: expected.criterion,
                    type: expected.type,
                    passed: false,
                    reasoning: 'Could not be evaluated from the conversation.',
                });
            }
        }

        const overallScore = typeof raw.overall_score === 'number'
            ? Math.max(0, Math.min(100, Math.round(raw.overall_score)))
            : 50;

        const evaluationSummary = typeof raw.evaluation_summary === 'string'
            ? raw.evaluation_summary.slice(0, 500)
            : '';

        const sentiment = ['positive', 'neutral', 'negative'].includes(raw.sentiment)
            ? raw.sentiment as 'positive' | 'neutral' | 'negative'
            : 'neutral';

        const topics = Array.isArray(raw.topics)
            ? raw.topics.filter((t: unknown) => typeof t === 'string').slice(0, 5) as string[]
            : [];

        return { criteriaResults, overallScore, evaluationSummary, sentiment, topics };
    } catch {
        return null;
    }
}

/**
 * Determine if a test passed based on evaluation results.
 */
export function determinePassFail(criteriaResults: CriterionResult[], overallScore: number): 'passed' | 'failed' {
    // Fail if any must_pass criterion failed
    const mustPassFailed = criteriaResults.some(cr => cr.type === 'must_pass' && !cr.passed);
    if (mustPassFailed) return 'failed';

    // Fail if any must_not_fail criterion was violated
    const mustNotFailViolated = criteriaResults.some(cr => cr.type === 'must_not_fail' && !cr.passed);
    if (mustNotFailViolated) return 'failed';

    // Fail if overall score is too low
    if (overallScore < 50) return 'failed';

    return 'passed';
}
