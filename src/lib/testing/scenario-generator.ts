/**
 * AI Scenario Generator
 *
 * Uses Claude Sonnet to analyze an agent's system prompt and generate
 * a set of diverse test cases covering happy paths, edge cases,
 * adversarial scenarios, and boundary conditions.
 */

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6-20250514';
const MAX_OUTPUT_TOKENS = 4096;

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

const GENERATION_SYSTEM_PROMPT = `You are a QA engineer specializing in AI voice agent testing. Given an agent's system prompt, you generate diverse test scenarios that thoroughly validate the agent's behavior.

You MUST return a JSON array of test case objects. Each test case has this structure:
{
  "name": "Short descriptive name for the test",
  "scenario": "Detailed scenario description that tells a simulated caller what situation they are in and what they want to accomplish",
  "success_criteria": [
    { "criterion": "Description of what the agent should do", "type": "must_pass" },
    { "criterion": "Description of what the agent should avoid", "type": "must_not_fail" },
    { "criterion": "Nice-to-have behavior", "type": "should_pass" }
  ],
  "tags": ["category1", "category2"],
  "suggested_persona": "friendly|angry|confused|impatient|skeptical|neutral"
}

Criterion types:
- "must_pass": Agent MUST do this for the test to pass (critical requirement)
- "must_not_fail": Agent must NOT violate this (guardrail/safety check)
- "should_pass": Bonus quality check (nice to have but not required)

Generate 6-10 test cases covering these categories:
1. **Happy Path** (2-3): Normal, straightforward interactions the agent should handle perfectly
2. **Edge Cases** (2-3): Unusual but valid requests, boundary conditions, ambiguous inputs
3. **Adversarial** (1-2): Attempts to confuse, manipulate, or trick the agent (social engineering, off-topic, prompt injection)
4. **Error Recovery** (1-2): Bad data, system failures, caller frustration, repeated requests

Make scenarios realistic and specific to what the agent actually does based on its prompt. Don't generate generic tests — ground every scenario in the agent's actual domain and capabilities.

Return ONLY the JSON array. No markdown, no explanation.`;

/**
 * Generate test scenarios from an agent prompt via streaming.
 * Returns a ReadableStream of newline-delimited JSON events.
 */
export async function generateScenariosStream(
    agentPrompt: string,
    agentName?: string,
): Promise<ReadableStream<Uint8Array>> {
    const client = getClient();
    const encoder = new TextEncoder();

    const userMessage = agentName
        ? `Generate test scenarios for the voice agent "${agentName}" with this system prompt:\n\n${agentPrompt}`
        : `Generate test scenarios for a voice agent with this system prompt:\n\n${agentPrompt}`;

    const stream = await client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: GENERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
    });

    let fullText = '';

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const event of stream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        fullText += event.delta.text;
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({ type: 'text_delta', text: event.delta.text }) + '\n'
                            )
                        );
                    }
                }

                // Parse the complete response
                const parsed = parseGeneratedCases(fullText);

                if (parsed) {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({ type: 'result', cases: parsed }) + '\n'
                        )
                    );
                } else {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({ type: 'error', message: 'Failed to parse generated test cases' }) + '\n'
                        )
                    );
                }

                controller.close();
            } catch (err) {
                console.error('Scenario generation error:', err instanceof Error ? err.message : 'Unknown error');
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            type: 'error',
                            message: err instanceof Error ? err.message : 'Generation failed',
                        }) + '\n'
                    )
                );
                controller.close();
            }
        },
    });
}

interface GeneratedCase {
    name: string;
    scenario: string;
    success_criteria: { criterion: string; type: 'must_pass' | 'should_pass' | 'must_not_fail' }[];
    tags: string[];
    suggested_persona: string;
}

function parseGeneratedCases(text: string): GeneratedCase[] | null {
    // Clean up the text — remove markdown fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) return null;

        // Validate each case has required fields
        return parsed.filter(
            (c: GeneratedCase) =>
                c.name &&
                c.scenario &&
                Array.isArray(c.success_criteria) &&
                c.success_criteria.length > 0
        );
    } catch {
        console.error('Failed to parse generated scenarios:', cleaned.substring(0, 200));
        return null;
    }
}
