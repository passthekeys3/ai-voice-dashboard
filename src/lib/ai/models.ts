/**
 * Claude models for the app's own AI features (call analysis, the AI agent
 * builder, testing). Unrelated to the LLMs the voice agents run on, which are
 * configured per provider in lib/constants/config.ts.
 */

/** High-volume structured work: call analysis, call simulation, prompt suggestions, workflow builder */
export const CLAUDE_FAST_MODEL = 'claude-haiku-5-5';

/** Higher-judgment work: agent builder chat, test evaluation, test scenario generation */
export const CLAUDE_SMART_MODEL = 'claude-sonnet-5-5';

/**
 * Thinking effort for every call. These models think by default and bill thinking
 * as output tokens; `low` is Anthropic's recommended level for chat, generation,
 * classification, and extraction, and keeps the per-call cost below the
 * previous Haiku 4.5 / Sonnet 4.6 models.
 */
export const CLAUDE_EFFORT = 'low' as const;

/**
 * Both models can decline a request (stop_reason "refusal"), returning no text.
 * Callers treat that like any other empty response; this gives a log line to find it.
 */
export function logIfRefused(feature: string, stopReason: string | null | undefined): void {
    if (stopReason === 'refusal') {
        console.warn(`[claude] ${feature}: request declined by safety classifier (stop_reason=refusal)`);
    }
}
