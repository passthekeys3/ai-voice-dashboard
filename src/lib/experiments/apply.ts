/**
 * Apply Experiment to Call Initiation
 *
 * Shared helper used by all call trigger routes (API trigger, GHL trigger,
 * HubSpot trigger, cron scheduler) to resolve and apply A/B experiment
 * traffic splitting before initiating a call.
 */

import type { CallInitiationParams } from '@/lib/calls/initiate';
import { resolveExperiment, injectExperimentMetadata } from './traffic-split';

interface ApplyExperimentParams {
    /** Internal agent UUID */
    agentId: string;
    /** Agency UUID */
    agencyId: string;
    /** Existing call initiation params (metadata will be enriched) */
    callParams: CallInitiationParams;
}

interface ApplyExperimentResult {
    /** Enriched call initiation params with experiment metadata + prompt override */
    callParams: CallInitiationParams;
    /** Whether an experiment was applied */
    experimentApplied: boolean;
    /** Experiment ID if applied */
    experimentId?: string;
    /** Variant ID if applied */
    variantId?: string;
}

/**
 * Check for a running experiment on the agent and, if found, select a variant
 * and enrich the call params with experiment metadata and prompt override.
 *
 * This is a no-op if no experiment is running for the agent — returns the
 * original callParams unchanged.
 */
export async function applyExperiment({
    agentId,
    agencyId,
    callParams,
}: ApplyExperimentParams): Promise<ApplyExperimentResult> {
    try {
        const assignment = await resolveExperiment(agentId, agencyId);

        if (!assignment) {
            return { callParams, experimentApplied: false };
        }

        // Enrich metadata with experiment tracking fields
        const enrichedMetadata = injectExperimentMetadata(
            callParams.metadata,
            assignment
        );

        // Build enriched call params
        const enrichedParams: CallInitiationParams = {
            ...callParams,
            metadata: enrichedMetadata,
            // Only set prompt override for non-control variants
            ...(assignment.prompt_override ? { promptOverride: assignment.prompt_override } : {}),
        };

        console.log(
            `[EXPERIMENT] Agent ${agentId}: assigned to experiment=${assignment.experiment_id}, ` +
            `variant=${assignment.variant_name} (${assignment.is_control ? 'control' : 'treatment'})`
        );

        return {
            callParams: enrichedParams,
            experimentApplied: true,
            experimentId: assignment.experiment_id,
            variantId: assignment.variant_id,
        };
    } catch (err) {
        // Experiment resolution failure should never block call initiation
        console.error('[EXPERIMENT] Failed to resolve experiment, proceeding without:', err);
        return { callParams, experimentApplied: false };
    }
}
