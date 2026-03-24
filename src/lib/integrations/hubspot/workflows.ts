/**
 * HubSpot workflow enrollment.
 *
 * Uses the Automation v4 API to enroll contacts into workflows
 * for post-call follow-ups (SMS, email sequences, etc.).
 */

import type { HubSpotConfig } from './shared';
import { hubspotFetch } from './shared';

/** Enroll a contact in a HubSpot workflow by workflow ID. */
export async function triggerWorkflow(
    config: HubSpotConfig,
    contactId: string,
    workflowId: string,
): Promise<{ success: boolean; error?: string }> {
    const result = await hubspotFetch(
        config,
        `/automation/v4/flows/${encodeURIComponent(workflowId)}/enrollments`,
        {
            method: 'POST',
            body: {
                objectId: contactId,
                objectType: 'CONTACT',
            },
        },
    );

    return result !== null
        ? { success: true }
        : { success: false, error: 'Failed to trigger workflow' };
}
