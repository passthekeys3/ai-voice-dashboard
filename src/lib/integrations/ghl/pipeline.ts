/**
 * GHL Pipeline/Opportunity operations.
 */

import { type GHLConfig, ghlFetch } from './shared';

/** Get pipelines for the location */
export async function getPipelines(
    config: GHLConfig,
): Promise<{ id: string; name: string; stages: { id: string; name: string }[] }[]> {
    const data = await ghlFetch<{ pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[] }>(
        config, '/opportunities/pipelines',
        { params: { locationId: config.locationId } },
    );
    return data?.pipelines || [];
}

/** Create or update an opportunity (pipeline stage) for a contact */
export async function updateContactPipeline(
    config: GHLConfig,
    contactId: string,
    pipelineId: string,
    stageId: string,
    opportunityName?: string,
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
    try {
        // Check for existing opportunity in this pipeline
        const searchData = await ghlFetch<{ opportunities: { id: string }[] }>(
            config, '/opportunities/search',
            { params: { locationId: config.locationId, contactId, pipelineId } },
        );

        const existingId = searchData?.opportunities?.[0]?.id;

        if (existingId) {
            // Update existing
            const result = await ghlFetch(config, `/opportunities/${existingId}`, {
                method: 'PUT',
                body: { pipelineStageId: stageId },
            });
            return result
                ? { success: true, opportunityId: existingId }
                : { success: false, error: 'Failed to update pipeline' };
        } else {
            // Create new
            const data = await ghlFetch<{ opportunity?: { id: string } }>(config, '/opportunities/', {
                method: 'POST',
                body: {
                    locationId: config.locationId,
                    contactId,
                    pipelineId,
                    pipelineStageId: stageId,
                    name: opportunityName || 'AI Voice Call Lead',
                    status: 'open',
                },
            });
            return data
                ? { success: true, opportunityId: data.opportunity?.id }
                : { success: false, error: 'Failed to update pipeline' };
        }
    } catch (error) {
        console.error('GHL updateContactPipeline error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update pipeline' };
    }
}
