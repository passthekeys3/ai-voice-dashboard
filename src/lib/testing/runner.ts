/**
 * Test Run Orchestrator
 *
 * Executes all test cases in a suite with controlled concurrency.
 * Updates database records per-case and streams progress via callback.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { simulateConversation } from './simulator';
import { evaluateConversation, determinePassFail } from './evaluator';
import type { TestCase, TestPersona, TestProgressUpdate } from '@/types';

// Haiku pricing (per million tokens) — for cost estimation
// https://docs.anthropic.com/en/docs/about-claude/models — Claude Haiku
const HAIKU_INPUT_PRICE_PER_M = 1.0;
const HAIKU_OUTPUT_PRICE_PER_M = 5.0;

const MAX_CONCURRENCY = 3;
const PER_CASE_TIMEOUT_MS = 60_000; // 60 seconds per test case

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)
        ),
    ]);
}

interface RunParams {
    runId: string;
    testCases: (TestCase & { persona?: TestPersona })[];
    agentPrompt: string;
    agentFirstMessage?: string;
    supabase: SupabaseClient;
    onProgress: (update: TestProgressUpdate) => void;
}

/**
 * Run controlled concurrency with a semaphore pattern.
 */
async function withConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    const executing = new Set<Promise<void>>();
    for (const item of items) {
        const p = fn(item).then(() => { executing.delete(p); });
        executing.add(p);
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
}

export async function executeTestRun(params: RunParams): Promise<void> {
    const { runId, testCases, agentPrompt, agentFirstMessage, supabase, onProgress } = params;
    const startTime = Date.now();

    // Mark run as started
    await supabase
        .from('test_runs')
        .update({ status: 'running', started_at: new Date().toISOString(), total_cases: testCases.length })
        .eq('id', runId);

    onProgress({ type: 'started', total: testCases.length });

    // Aggregate counters
    let passed = 0;
    let failed = 0;
    let errored = 0;
    let totalScore = 0;
    let scoredCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let completedCount = 0;

    // Execute test cases with concurrency control
    await withConcurrency(testCases, MAX_CONCURRENCY, async (testCase) => {
        const caseStartTime = Date.now();

        onProgress({ type: 'case_started', case_id: testCase.id, case_name: testCase.name });

        // Mark result as running
        await supabase
            .from('test_results')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('test_run_id', runId)
            .eq('test_case_id', testCase.id);

        try {
            // Build a default persona if none assigned
            const persona: TestPersona = testCase.persona || {
                id: '',
                agency_id: '',
                name: 'Default Caller',
                traits: {
                    temperament: 'neutral',
                    communication_style: 'direct',
                    knowledge_level: 'moderate',
                    objection_tendency: 'low',
                },
                is_preset: false,
                created_at: '',
                updated_at: '',
            };

            // 1. Simulate conversation (with timeout)
            const simulation = await withTimeout(
                simulateConversation({
                    agentSystemPrompt: agentPrompt,
                    agentFirstMessage,
                    scenario: testCase.scenario,
                    persona,
                    maxTurns: testCase.max_turns || 20,
                }),
                PER_CASE_TIMEOUT_MS,
                `simulation for "${testCase.name}"`,
            );

            // 2. Evaluate against criteria
            const evaluation = await evaluateConversation({
                transcript: simulation.transcript,
                successCriteria: testCase.success_criteria,
                scenario: testCase.scenario,
                agentSystemPrompt: agentPrompt,
            });

            const caseInputTokens = simulation.totalInputTokens + (evaluation?.inputTokens || 0);
            const caseOutputTokens = simulation.totalOutputTokens + (evaluation?.outputTokens || 0);
            totalInputTokens += caseInputTokens;
            totalOutputTokens += caseOutputTokens;

            // 3. Determine status
            let resultStatus: 'passed' | 'failed' | 'errored' = 'failed';
            if (evaluation) {
                resultStatus = determinePassFail(evaluation.criteriaResults, evaluation.overallScore);
            }

            const caseDurationMs = Date.now() - caseStartTime;

            // 4. Update result record
            await supabase
                .from('test_results')
                .update({
                    status: resultStatus,
                    transcript: simulation.transcript,
                    turn_count: simulation.turnCount,
                    criteria_results: evaluation?.criteriaResults || [],
                    overall_score: evaluation?.overallScore || 0,
                    evaluation_summary: evaluation?.evaluationSummary || '',
                    sentiment: evaluation?.sentiment,
                    topics: evaluation?.topics || [],
                    completed_at: new Date().toISOString(),
                    duration_ms: caseDurationMs,
                    input_tokens: caseInputTokens,
                    output_tokens: caseOutputTokens,
                })
                .eq('test_run_id', runId)
                .eq('test_case_id', testCase.id);

            if (resultStatus === 'passed') passed++;
            else failed++;

            if (evaluation?.overallScore != null) {
                totalScore += evaluation.overallScore;
                scoredCount++;
            }

            completedCount++;
            onProgress({
                type: 'case_completed',
                case_id: testCase.id,
                case_name: testCase.name,
                status: resultStatus,
                score: evaluation?.overallScore,
            });
            onProgress({ type: 'progress', completed: completedCount, total: testCases.length });

        } catch (error) {
            errored++;
            completedCount++;

            await supabase
                .from('test_results')
                .update({
                    status: 'errored',
                    error_message: error instanceof Error ? error.message : 'Unknown error',
                    completed_at: new Date().toISOString(),
                    duration_ms: Date.now() - caseStartTime,
                })
                .eq('test_run_id', runId)
                .eq('test_case_id', testCase.id);

            onProgress({
                type: 'case_completed',
                case_id: testCase.id,
                case_name: testCase.name,
                status: 'errored',
            });
            onProgress({ type: 'progress', completed: completedCount, total: testCases.length });
        }
    });

    // Compute aggregate stats
    const avgScore = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 100) / 100 : null;
    const estimatedCostCents = Math.ceil(
        (totalInputTokens * HAIKU_INPUT_PRICE_PER_M / 1_000_000 +
         totalOutputTokens * HAIKU_OUTPUT_PRICE_PER_M / 1_000_000) * 100
    );
    const durationMs = Date.now() - startTime;

    // Update run record
    await supabase
        .from('test_runs')
        .update({
            status: 'completed',
            passed_cases: passed,
            failed_cases: failed,
            errored_cases: errored,
            avg_score: avgScore,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            total_input_tokens: totalInputTokens,
            total_output_tokens: totalOutputTokens,
            estimated_cost_cents: estimatedCostCents,
        })
        .eq('id', runId);

    onProgress({
        type: 'complete',
        run_id: runId,
        passed,
        failed,
        errored,
        avg_score: avgScore ?? undefined,
    });
}
