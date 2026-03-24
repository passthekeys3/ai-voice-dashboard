/**
 * HubSpot meeting operations.
 *
 * Creates, cancels, and queries CRM Meeting engagements.
 * Also provides a high-level bookNextAvailableMeeting that
 * upserts the contact first, then creates the meeting.
 */

import type { HubSpotConfig, HubSpotMeeting } from './shared';
import { hubspotFetch, HUBSPOT_API_BASE, HUBSPOT_API_TIMEOUT } from './shared';
import { upsertContact } from './contacts';

/**
 * Create a meeting engagement and associate it with a contact.
 * Uses associationTypeId 200 (Meeting → Contact).
 */
export async function createMeeting(
    config: HubSpotConfig,
    params: {
        contactId: string;
        title: string;
        startTime: string;   // ISO timestamp
        endTime: string;     // ISO timestamp
        description?: string;
        outcome?: string;
    },
): Promise<{ success: boolean; meetingId?: string; error?: string }> {
    const data = await hubspotFetch<{ id: string }>(config, '/crm/v3/objects/meetings', {
        method: 'POST',
        body: {
            properties: {
                hs_timestamp: params.startTime,
                hs_meeting_title: params.title,
                hs_meeting_start_time: params.startTime,
                hs_meeting_end_time: params.endTime,
                hs_meeting_body: params.description || '',
                hs_meeting_outcome: params.outcome || 'SCHEDULED',
            },
            associations: [{
                to: { id: params.contactId },
                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
            }],
        },
    });

    return data
        ? { success: true, meetingId: data.id }
        : { success: false, error: 'Failed to create meeting' };
}

/** Cancel a meeting by setting its outcome to CANCELED. */
export async function cancelMeeting(
    config: HubSpotConfig,
    meetingId: string,
): Promise<{ success: boolean; error?: string }> {
    const result = await hubspotFetch(
        config,
        `/crm/v3/objects/meetings/${encodeURIComponent(meetingId)}`,
        {
            method: 'PATCH',
            body: { properties: { hs_meeting_outcome: 'CANCELED' } },
        },
    );

    return result
        ? { success: true }
        : { success: false, error: 'Failed to cancel meeting' };
}

/**
 * Get all meetings associated with a contact.
 *
 * Two-step process:
 * 1. Fetch meeting IDs via the associations endpoint
 * 2. Batch-read meeting details in a single call
 */
export async function getMeetingsByContact(
    config: HubSpotConfig,
    contactId: string,
): Promise<HubSpotMeeting[]> {
    try {
        // Step 1: Get associated meeting IDs
        const assocData = await hubspotFetch<{
            results: { id: string }[];
        }>(config, `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/meetings`);

        const meetingIds = assocData?.results?.map(a => a.id) || [];
        if (meetingIds.length === 0) return [];

        // Step 2: Batch-read meeting details
        const batchResponse = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/meetings/batch/read`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(HUBSPOT_API_TIMEOUT),
                body: JSON.stringify({
                    inputs: meetingIds.map(id => ({ id })),
                    properties: [
                        'hs_timestamp', 'hs_meeting_title',
                        'hs_meeting_start_time', 'hs_meeting_end_time',
                        'hs_meeting_outcome',
                    ],
                }),
            },
        );

        if (!batchResponse.ok) return [];

        const batchData = await batchResponse.json();
        return (batchData.results || []) as HubSpotMeeting[];
    } catch (error) {
        console.error('HubSpot getMeetingsByContact error:', error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}

/**
 * High-level meeting booking:
 * 1. Upsert the contact by phone number
 * 2. Create a meeting engagement linked to them
 */
export async function bookNextAvailableMeeting(
    config: HubSpotConfig,
    params: {
        phoneNumber: string;
        contactName?: string;
        title: string;
        startTime: string;
        endTime: string;
        description?: string;
        timezone?: string;
    },
): Promise<{ success: boolean; meetingId?: string; contactId?: string; error?: string }> {
    try {
        // Split "First Last" into firstName / lastName
        const nameParts = params.contactName?.split(' ') || [];
        const upsertResult = await upsertContact(config, params.phoneNumber, {
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || undefined,
        });

        if (!upsertResult.success || !upsertResult.contactId) {
            return { success: false, error: 'Failed to book meeting' };
        }

        const meetingResult = await createMeeting(config, {
            contactId: upsertResult.contactId,
            title: params.title,
            startTime: params.startTime,
            endTime: params.endTime,
            description: params.description,
        });

        return meetingResult.success
            ? { success: true, meetingId: meetingResult.meetingId, contactId: upsertResult.contactId }
            : { success: false, contactId: upsertResult.contactId, error: 'Failed to book meeting' };
    } catch (error) {
        console.error('HubSpot bookNextAvailableMeeting error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to book meeting' };
    }
}
