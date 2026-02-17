/**
 * Experiment Traffic Splitting
 *
 * Handles variant selection for A/B testing experiments.
 * When a call is initiated for an agent with a running experiment,
 * this module selects a variant based on traffic weights and returns
 * the variant's prompt override + metadata to inject into the call.
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface ExperimentVariant {
    id: string;
    experiment_id: string;
    name: string;
    prompt: string;
    traffic_weight: number;
    is_control: boolean;
}

export interface ExperimentAssignment {
    experiment_id: string;
    variant_id: string;
    variant_name: string;
    prompt_override: string | null; // null for control variant (use agent's default prompt)
    is_control: boolean;
}

/**
 * Select a variant based on weighted random selection.
 * Weights don't need to sum to 100 — they're treated as relative proportions.
 */
export function selectVariant(variants: ExperimentVariant[]): ExperimentVariant {
    if (variants.length === 0) {
        throw new Error('No variants to select from');
    }
    if (variants.length === 1) {
        return variants[0];
    }

    const totalWeight = variants.reduce((sum, v) => sum + v.traffic_weight, 0);
    if (totalWeight <= 0) {
        // Equal distribution if all weights are 0
        return variants[Math.floor(Math.random() * variants.length)];
    }

    const random = Math.random() * totalWeight;
    let cumulative = 0;

    for (const variant of variants) {
        cumulative += variant.traffic_weight;
        if (random < cumulative) {
            return variant;
        }
    }

    // Fallback (shouldn't happen due to floating point, but just in case)
    return variants[variants.length - 1];
}

/**
 * Look up the running experiment for an agent and select a variant.
 * Returns null if no experiment is running for this agent.
 *
 * @param agentId - Internal agent UUID (not external_id)
 * @param agencyId - Agency UUID for scoping
 */
export async function resolveExperiment(
    agentId: string,
    agencyId: string
): Promise<ExperimentAssignment | null> {
    const supabase = createServiceClient();

    // Find the active (running) experiment for this agent
    const { data: experiment, error: expError } = await supabase
        .from('experiments')
        .select('id, agent_id')
        .eq('agent_id', agentId)
        .eq('agency_id', agencyId)
        .eq('status', 'running')
        .limit(1)
        .maybeSingle();

    if (expError || !experiment) {
        return null;
    }

    // Fetch variants for this experiment
    const { data: variants, error: varError } = await supabase
        .from('experiment_variants')
        .select('id, experiment_id, name, prompt, traffic_weight, is_control')
        .eq('experiment_id', experiment.id)
        .order('is_control', { ascending: false }); // Control first

    if (varError || !variants || variants.length === 0) {
        return null;
    }

    // Select a variant based on traffic weights
    const selected = selectVariant(variants as ExperimentVariant[]);

    return {
        experiment_id: experiment.id,
        variant_id: selected.id,
        variant_name: selected.name,
        // Control variant uses the agent's default prompt (no override needed)
        prompt_override: selected.is_control ? null : selected.prompt,
        is_control: selected.is_control,
    };
}

/**
 * Build metadata object with experiment tracking fields.
 * Merges experiment assignment into existing call metadata.
 */
export function injectExperimentMetadata(
    existingMetadata: Record<string, unknown> | undefined,
    assignment: ExperimentAssignment
): Record<string, unknown> {
    return {
        ...(existingMetadata || {}),
        experiment_id: assignment.experiment_id,
        variant_id: assignment.variant_id,
        variant_name: assignment.variant_name,
        is_control: assignment.is_control,
    };
}
