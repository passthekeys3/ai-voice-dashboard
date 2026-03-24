/**
 * HubSpot deal pipeline operations.
 *
 * Manages deal pipelines and creates/updates deals to track
 * contacts through sales stages (e.g., "New Lead" → "Qualified" → "Won").
 */

import type { HubSpotConfig, HubSpotPipeline } from './shared';
import { hubspotFetch, HUBSPOT_API_BASE, HUBSPOT_API_TIMEOUT } from './shared';

/** Get all deal pipelines and their stages for the account. */
export async function getPipelines(
    config: HubSpotConfig,
): Promise<HubSpotPipeline[]> {
    const data = await hubspotFetch<{
        results: { id: string; label: string; stages: { id: string; label: string }[] }[];
    }>(config, '/crm/v3/pipelines/deals');

    if (!data?.results) return [];

    return data.results.map(p => ({
        id: p.id,
        label: p.label,
        stages: (p.stages || []).map(s => ({ id: s.id, label: s.label })),
    }));
}

/**
 * Create or update a deal in a pipeline for a contact.
 *
 * Flow:
 * 1. Get all deal IDs associated with this contact
 * 2. Check each deal to find one in the target pipeline
 * 3. If found → update the deal's stage
 * 4. If not found → create a new deal and associate it
 *
 * The N+1 pattern in step 2 is acceptable because contacts typically
 * have 1-5 deals, not hundreds. A batch read would be more complex
 * and slower for this common case.
 */
export async function updateContactPipeline(
    config: HubSpotConfig,
    contactId: string,
    pipelineId: string,
    stageId: string,
    dealName?: string,
): Promise<{ success: boolean; dealId?: string; error?: string }> {
    try {
        // Step 1: Get deal IDs associated with this contact
        let existingDealId: string | null = null;

        const assocData = await hubspotFetch<{
            results: { id: string }[];
        }>(config, `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/deals`);

        if (assocData?.results) {
            // Step 2: Find a deal in the target pipeline
            // Contacts usually have 1-5 deals, so sequential fetches are fine here
            for (const { id: dealId } of assocData.results) {
                const dealResponse = await fetch(
                    `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${encodeURIComponent(dealId)}?properties=pipeline,dealstage`,
                    {
                        headers: { 'Authorization': `Bearer ${config.accessToken}` },
                        signal: AbortSignal.timeout(HUBSPOT_API_TIMEOUT),
                    },
                );
                if (dealResponse.ok) {
                    const dealData = await dealResponse.json();
                    if (dealData.properties?.pipeline === pipelineId) {
                        existingDealId = dealId;
                        break;
                    }
                }
            }
        }

        // Step 3: Update existing deal or create a new one
        if (existingDealId) {
            const result = await hubspotFetch(
                config,
                `/crm/v3/objects/deals/${encodeURIComponent(existingDealId)}`,
                { method: 'PATCH', body: { properties: { dealstage: stageId } } },
            );
            return result
                ? { success: true, dealId: existingDealId }
                : { success: false, error: 'Failed to update pipeline' };
        }

        // Step 4: Create new deal with contact association (typeId 3 = Deal → Contact)
        const data = await hubspotFetch<{ id: string }>(config, '/crm/v3/objects/deals', {
            method: 'POST',
            body: {
                properties: {
                    dealname: dealName || 'AI Voice Call Lead',
                    pipeline: pipelineId,
                    dealstage: stageId,
                },
                associations: [{
                    to: { id: contactId },
                    types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
                }],
            },
        });

        return data
            ? { success: true, dealId: data.id }
            : { success: false, error: 'Failed to update pipeline' };
    } catch (error) {
        console.error('HubSpot updateContactPipeline error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update pipeline' };
    }
}
