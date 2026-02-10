/**
 * HubSpot API Client
 *
 * Uses HubSpot CRM API v3 for contact management and call logging
 * Docs: https://developers.hubspot.com/docs/api/crm/contacts
 */

const HUBSPOT_API_BASE = 'https://api.hubspot.com';

export interface HubSpotConfig {
    accessToken: string;
}

export interface HubSpotContact {
    id: string;
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        hs_lead_status?: string;
        [key: string]: string | undefined;
    };
}

interface HubSpotSearchResponse {
    total: number;
    results: HubSpotContact[];
}

interface HubSpotCreateResponse {
    id: string;
    properties: Record<string, string>;
}

/**
 * Search for a contact by phone number
 */
export async function searchContactByPhone(
    config: HubSpotConfig,
    phoneNumber: string
): Promise<HubSpotContact | null> {
    try {
        // Normalize phone number (remove non-digits except leading +)
        const normalizedPhone = phoneNumber.replace(/[^0-9+]/g, '');

        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filterGroups: [{
                        filters: [{
                            propertyName: 'phone',
                            operator: 'CONTAINS_TOKEN',
                            value: normalizedPhone.replace(/^\+/, ''), // Remove leading + for search
                        }]
                    }],
                    properties: ['firstname', 'lastname', 'email', 'phone', 'hs_lead_status', 'ai_call_tags'],
                    limit: 1,
                }),
            }
        );

        if (!response.ok) {
            console.error('HubSpot search contact error:', await response.text());
            return null;
        }

        const data: HubSpotSearchResponse = await response.json();

        if (data.results && data.results.length > 0) {
            return data.results[0];
        }

        return null;
    } catch (error) {
        console.error('HubSpot searchContactByPhone error:', error);
        return null;
    }
}

/**
 * Search for a contact by email
 */
export async function searchContactByEmail(
    config: HubSpotConfig,
    email: string
): Promise<HubSpotContact | null> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filterGroups: [{
                        filters: [{
                            propertyName: 'email',
                            operator: 'EQ',
                            value: email.toLowerCase(),
                        }]
                    }],
                    properties: ['firstname', 'lastname', 'email', 'phone', 'hs_lead_status', 'ai_call_tags'],
                    limit: 1,
                }),
            }
        );

        if (!response.ok) {
            console.error('HubSpot search by email error:', await response.text());
            return null;
        }

        const data: HubSpotSearchResponse = await response.json();

        if (data.results && data.results.length > 0) {
            return data.results[0];
        }

        return null;
    } catch (error) {
        console.error('HubSpot searchContactByEmail error:', error);
        return null;
    }
}

/**
 * Create a new contact in HubSpot
 */
export async function createContact(
    config: HubSpotConfig,
    contact: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        leadStatus?: string;
    }
): Promise<HubSpotContact | null> {
    try {
        const properties: Record<string, string> = {};

        if (contact.firstName) properties.firstname = contact.firstName;
        if (contact.lastName) properties.lastname = contact.lastName;
        if (contact.phone) properties.phone = contact.phone;
        if (contact.email) properties.email = contact.email;
        properties.hs_lead_status = contact.leadStatus || 'NEW';

        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
            }
        );

        if (!response.ok) {
            console.error('HubSpot create contact error:', await response.text());
            return null;
        }

        const data: HubSpotCreateResponse = await response.json();
        return {
            id: data.id,
            properties: data.properties,
        };
    } catch (error) {
        console.error('HubSpot createContact error:', error);
        return null;
    }
}

/**
 * Update contact properties
 */
export async function updateContact(
    config: HubSpotConfig,
    contactId: string,
    properties: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HubSpot update contact error:', errorText);
            return { success: false, error: 'Failed to update HubSpot contact' };
        }

        return { success: true };
    } catch (error) {
        console.error('HubSpot updateContact error:', error);
        return { success: false, error: 'Failed to update HubSpot contact' };
    }
}

/**
 * Create a call engagement and associate with a contact
 */
export async function createCallEngagement(
    config: HubSpotConfig,
    contactId: string,
    callData: {
        title: string;
        body: string;
        direction: 'INBOUND' | 'OUTBOUND';
        status: 'COMPLETED' | 'NO_ANSWER' | 'BUSY' | 'FAILED';
        durationMs: number;
        fromNumber?: string;
        toNumber?: string;
        timestamp: string;
    }
): Promise<{ success: boolean; callId?: string; error?: string }> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/calls`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        hs_timestamp: callData.timestamp,
                        hs_call_title: callData.title,
                        hs_call_body: callData.body,
                        hs_call_direction: callData.direction,
                        hs_call_status: callData.status,
                        hs_call_duration: String(callData.durationMs),
                        ...(callData.fromNumber && { hs_call_from_number: callData.fromNumber }),
                        ...(callData.toNumber && { hs_call_to_number: callData.toNumber }),
                    },
                    associations: [{
                        to: { id: contactId },
                        types: [{
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 194, // Call to Contact association
                        }]
                    }]
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HubSpot create call error:', errorText);
            return { success: false, error: 'Failed to create call engagement' };
        }

        const data = await response.json();
        return { success: true, callId: data.id };
    } catch (error) {
        console.error('HubSpot createCallEngagement error:', error);
        return { success: false, error: 'Failed to create call engagement' };
    }
}

/**
 * Log an AI voice call to a HubSpot contact
 * - Finds or creates contact by phone
 * - Creates call engagement with summary and transcript
 */
export async function logCallToHubSpot(
    config: HubSpotConfig,
    callData: {
        phoneNumber: string;
        direction: 'inbound' | 'outbound';
        durationSeconds: number;
        summary?: string;
        transcript?: string;
        recordingUrl?: string;
        sentiment?: string;
        agentName?: string;
        startedAt: string;
    }
): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
        if (!config.accessToken) {
            return { success: false, error: 'HubSpot not configured' };
        }

        // Find or create contact
        let contact = await searchContactByPhone(config, callData.phoneNumber);

        if (!contact) {
            contact = await createContact(config, {
                phone: callData.phoneNumber,
                firstName: 'Unknown',
                leadStatus: 'NEW',
            });
        }

        if (!contact) {
            return { success: false, error: 'Failed to find or create contact' };
        }

        // Format call duration
        const minutes = Math.floor(callData.durationSeconds / 60);
        const seconds = callData.durationSeconds % 60;
        const durationStr = `${minutes}m ${seconds}s`;

        // Build call body content
        let callBody = `AI Voice Call (${callData.direction})\n`;
        callBody += `Duration: ${durationStr}\n`;

        if (callData.agentName) {
            callBody += `Agent: ${callData.agentName}\n`;
        }

        if (callData.sentiment) {
            callBody += `Sentiment: ${callData.sentiment}\n`;
        }

        callBody += '\n';

        if (callData.summary) {
            callBody += `Summary:\n${callData.summary}\n\n`;
        }

        if (callData.recordingUrl) {
            callBody += `Recording: ${callData.recordingUrl}\n\n`;
        }

        if (callData.transcript) {
            // Truncate transcript if too long (HubSpot has character limits)
            const maxTranscriptLength = 5000;
            const transcript = callData.transcript.length > maxTranscriptLength
                ? callData.transcript.slice(0, maxTranscriptLength) + '...(truncated)'
                : callData.transcript;
            callBody += `Transcript:\n${transcript}`;
        }

        // Determine call status
        const callStatus = callData.durationSeconds > 0 ? 'COMPLETED' : 'NO_ANSWER';

        // Create call engagement
        const callResult = await createCallEngagement(config, contact.id, {
            title: `AI Voice Call - ${callData.agentName || 'Prosody'}`,
            body: callBody,
            direction: callData.direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
            status: callStatus,
            durationMs: callData.durationSeconds * 1000,
            fromNumber: callData.direction === 'inbound' ? callData.phoneNumber : undefined,
            toNumber: callData.direction === 'outbound' ? callData.phoneNumber : undefined,
            timestamp: callData.startedAt,
        });

        if (!callResult.success) {
            return { success: false, contactId: contact.id, error: 'Failed to log call to HubSpot' };
        }

        return { success: true, contactId: contact.id };
    } catch (error) {
        console.error('logCallToHubSpot error:', error);
        return { success: false, error: 'Failed to log call to HubSpot' };
    }
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    try {
        const response = await fetch(
            'https://api.hubapi.com/oauth/v1/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                }),
            }
        );

        if (!response.ok) {
            console.error('HubSpot refresh token error:', await response.text());
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
        };
    } catch (error) {
        console.error('HubSpot refreshAccessToken error:', error);
        return null;
    }
}

// ============================================
// Extended HubSpot Integration Functions
// ============================================

export interface HubSpotDeal {
    id: string;
    properties: {
        dealname?: string;
        dealstage?: string;
        pipeline?: string;
        amount?: string;
        [key: string]: string | undefined;
    };
}

export interface HubSpotMeeting {
    id: string;
    properties: {
        hs_timestamp?: string;
        hs_meeting_title?: string;
        hs_meeting_start_time?: string;
        hs_meeting_end_time?: string;
        hs_meeting_outcome?: string;
        [key: string]: string | undefined;
    };
}

export interface HubSpotPipeline {
    id: string;
    label: string;
    stages: { id: string; label: string }[];
}

/**
 * Find or create a contact by phone number, optionally updating with new data.
 */
export async function upsertContact(
    config: HubSpotConfig,
    phoneNumber: string,
    data?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        source?: string;
        tags?: string[];
        properties?: Record<string, string>;
    },
): Promise<{ success: boolean; contactId?: string; isNew?: boolean; error?: string }> {
    try {
        let contact = await searchContactByPhone(config, phoneNumber);
        let isNew = false;

        if (!contact) {
            contact = await createContact(config, {
                phone: phoneNumber,
                firstName: data?.firstName || 'Unknown',
                leadStatus: 'NEW',
            });
            isNew = true;
        }

        if (!contact) {
            return { success: false, error: 'Failed to find or create contact' };
        }

        // Update with additional data if provided
        const updates: Record<string, string> = {};
        if (data?.firstName && (isNew || data.firstName !== 'Unknown')) updates.firstname = data.firstName;
        if (data?.lastName) updates.lastname = data.lastName;
        if (data?.email) updates.email = data.email;
        if (data?.source) updates.hs_analytics_source = data.source;
        if (data?.properties) Object.assign(updates, data.properties);

        // Merge tags into ai_call_tags property
        if (data?.tags && data.tags.length > 0) {
            const existingTags = contact.properties.ai_call_tags?.split(';').filter(Boolean) || [];
            const mergedTags = [...new Set([...existingTags, ...data.tags])];
            updates.ai_call_tags = mergedTags.join(';');
        }

        if (Object.keys(updates).length > 0) {
            const updateResult = await updateContact(config, contact.id, updates);
            if (!updateResult.success) {
                console.error('HubSpot upsertContact update failed:', updateResult.error);
                // Still return success with contactId since the contact exists
                return { success: true, contactId: contact.id, isNew, error: 'Failed to upsert HubSpot contact' };
            }
        }

        return { success: true, contactId: contact.id, isNew };
    } catch (error) {
        console.error('HubSpot upsertContact error:', error);
        return { success: false, error: 'Failed to upsert HubSpot contact' };
    }
}

/**
 * Add a note to a HubSpot contact.
 * Uses the Notes CRM object with association to contact.
 */
export async function addNoteToContact(
    config: HubSpotConfig,
    contactId: string,
    noteBody: string,
): Promise<{ success: boolean; noteId?: string; error?: string }> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/notes`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        hs_timestamp: new Date().toISOString(),
                        hs_note_body: noteBody,
                    },
                    associations: [{
                        to: { id: contactId },
                        types: [{
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 202, // Note to Contact
                        }],
                    }],
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HubSpot add note error:', errorText);
            return { success: false, error: 'Failed to add note to contact' };
        }

        const data = await response.json();
        return { success: true, noteId: data.id };
    } catch (error) {
        console.error('HubSpot addNoteToContact error:', error);
        return { success: false, error: 'Failed to add note to contact' };
    }
}

/**
 * Add a rich formatted call note to a contact.
 * Mirrors GHL addCallNoteToContact with same formatting.
 */
export async function addCallNoteToContact(
    config: HubSpotConfig,
    contactId: string,
    callData: {
        direction?: string;
        duration_seconds?: number;
        agent_name?: string;
        sentiment?: string;
        summary?: string;
        transcript?: string;
        recording_url?: string;
        from_number?: string;
        to_number?: string;
        lead_timezone?: string;
        topics?: string[];
    },
    options?: {
        includeTranscript?: boolean;
        includeRecording?: boolean;
        maxTranscriptLength?: number;
        noteTitle?: string;
    },
): Promise<{ success: boolean; error?: string }> {
    try {
        const title = options?.noteTitle || 'AI Voice Call Summary';
        const maxLen = options?.maxTranscriptLength || 3000;

        const minutes = Math.floor((callData.duration_seconds || 0) / 60);
        const seconds = (callData.duration_seconds || 0) % 60;

        const lines: string[] = [
            `--- ${title} ---`,
            '',
            `Direction: ${callData.direction || 'unknown'}`,
            `Duration: ${minutes}m ${seconds}s`,
        ];

        if (callData.agent_name) lines.push(`Agent: ${callData.agent_name}`);
        if (callData.sentiment) lines.push(`Sentiment: ${callData.sentiment}`);
        if (callData.lead_timezone) lines.push(`Lead Timezone: ${callData.lead_timezone}`);
        if (callData.from_number) lines.push(`From: ${callData.from_number}`);
        if (callData.to_number) lines.push(`To: ${callData.to_number}`);

        if (callData.topics && callData.topics.length > 0) {
            lines.push(`Topics: ${callData.topics.join(', ')}`);
        }

        if (callData.summary) {
            lines.push('', 'Summary:', callData.summary);
        }

        if (options?.includeRecording !== false && callData.recording_url) {
            lines.push('', `Recording: ${callData.recording_url}`);
        }

        if (options?.includeTranscript !== false && callData.transcript) {
            const truncated = callData.transcript.length > maxLen
                ? callData.transcript.slice(0, maxLen) + '...(truncated)'
                : callData.transcript;
            lines.push('', 'Transcript:', truncated);
        }

        return await addNoteToContact(config, contactId, lines.join('\n'));
    } catch (error) {
        console.error('HubSpot addCallNoteToContact error:', error);
        return { success: false, error: 'Failed to add call note' };
    }
}

/**
 * Update a single property on a contact.
 */
export async function updateContactProperty(
    config: HubSpotConfig,
    contactId: string,
    propertyName: string,
    value: string | number,
): Promise<{ success: boolean; error?: string }> {
    return updateContact(config, contactId, { [propertyName]: String(value) });
}

/**
 * Update tags on a contact using the ai_call_tags custom property.
 * HubSpot doesn't have native tags; we use a semicolon-separated property.
 * Merges new tags with existing tags to avoid data loss.
 */
export async function updateContactTags(
    config: HubSpotConfig,
    contactId: string,
    tags: string[],
): Promise<{ success: boolean; error?: string }> {
    // Fetch existing tags first to merge
    let existingTags: string[] = [];
    try {
        const contactResponse = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}?properties=ai_call_tags`,
            {
                headers: { 'Authorization': `Bearer ${config.accessToken}` },
            }
        );
        if (contactResponse.ok) {
            const contactData = await contactResponse.json();
            existingTags = contactData.properties?.ai_call_tags?.split(';').filter(Boolean) || [];
        }
    } catch {
        // If fetch fails, proceed with just the new tags
    }

    const mergedTags = [...new Set([...existingTags, ...tags])];
    return updateContact(config, contactId, {
        ai_call_tags: mergedTags.join(';'),
    });
}

// ============================================
// Deal Pipeline Functions
// ============================================

/**
 * Get all deal pipelines and their stages.
 */
export async function getPipelines(
    config: HubSpotConfig,
): Promise<HubSpotPipeline[]> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/pipelines/deals`,
            {
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            console.error('HubSpot get pipelines error:', await response.text());
            return [];
        }

        const data = await response.json();
        return (data.results || []).map((p: { id: string; label: string; stages: { id: string; label: string }[] }) => ({
            id: p.id,
            label: p.label,
            stages: (p.stages || []).map((s: { id: string; label: string }) => ({ id: s.id, label: s.label })),
        }));
    } catch (error) {
        console.error('HubSpot getPipelines error:', error);
        return [];
    }
}

/**
 * Create or update a deal in a pipeline stage for a contact.
 */
export async function updateContactPipeline(
    config: HubSpotConfig,
    contactId: string,
    pipelineId: string,
    stageId: string,
    dealName?: string,
): Promise<{ success: boolean; dealId?: string; error?: string }> {
    try {
        // Search for existing deal associated with this contact in this pipeline
        const searchResponse = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filterGroups: [{
                        filters: [
                            { propertyName: 'pipeline', operator: 'EQ', value: pipelineId },
                        ],
                    }],
                    properties: ['dealname', 'dealstage', 'pipeline'],
                    limit: 100,
                }),
            }
        );

        let existingDealId: string | null = null;

        if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            // Check associations to find deals linked to this contact
            for (const deal of searchData.results || []) {
                const assocResponse = await fetch(
                    `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${deal.id}/associations/contacts`,
                    {
                        headers: { 'Authorization': `Bearer ${config.accessToken}` },
                    }
                );
                if (assocResponse.ok) {
                    const assocData = await assocResponse.json();
                    if ((assocData.results || []).some((a: { id: string }) => a.id === contactId)) {
                        existingDealId = deal.id;
                        break;
                    }
                }
            }
        }

        if (existingDealId) {
            // Update existing deal stage
            const updateResponse = await fetch(
                `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${existingDealId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${config.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        properties: { dealstage: stageId },
                    }),
                }
            );

            if (!updateResponse.ok) {
                console.error('HubSpot update deal error:', await updateResponse.text());
                return { success: false, error: 'Failed to update pipeline' };
            }
            return { success: true, dealId: existingDealId };
        }

        // Create new deal
        const createResponse = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/deals`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        dealname: dealName || 'AI Voice Call Lead',
                        pipeline: pipelineId,
                        dealstage: stageId,
                    },
                    associations: [{
                        to: { id: contactId },
                        types: [{
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 3, // Deal to Contact
                        }],
                    }],
                }),
            }
        );

        if (!createResponse.ok) {
            console.error('HubSpot create deal error:', await createResponse.text());
            return { success: false, error: 'Failed to update pipeline' };
        }

        const dealData = await createResponse.json();
        return { success: true, dealId: dealData.id };
    } catch (error) {
        console.error('HubSpot updateContactPipeline error:', error);
        return { success: false, error: 'Failed to update pipeline' };
    }
}

// ============================================
// Meeting Functions
// ============================================

/**
 * Create a meeting engagement associated with a contact.
 */
export async function createMeeting(
    config: HubSpotConfig,
    params: {
        contactId: string;
        title: string;
        startTime: string;  // ISO timestamp
        endTime: string;    // ISO timestamp
        description?: string;
        outcome?: string;
    },
): Promise<{ success: boolean; meetingId?: string; error?: string }> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/meetings`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
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
                        types: [{
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 200, // Meeting to Contact
                        }],
                    }],
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HubSpot create meeting error:', errorText);
            return { success: false, error: 'Failed to create meeting' };
        }

        const data = await response.json();
        return { success: true, meetingId: data.id };
    } catch (error) {
        console.error('HubSpot createMeeting error:', error);
        return { success: false, error: 'Failed to create meeting' };
    }
}

/**
 * Cancel a meeting by updating its outcome.
 */
export async function cancelMeeting(
    config: HubSpotConfig,
    meetingId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/meetings/${meetingId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        hs_meeting_outcome: 'CANCELED',
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HubSpot cancel meeting error:', errorText);
            return { success: false, error: 'Failed to cancel meeting' };
        }

        return { success: true };
    } catch (error) {
        console.error('HubSpot cancelMeeting error:', error);
        return { success: false, error: 'Failed to cancel meeting' };
    }
}

/**
 * Get meetings associated with a contact.
 */
export async function getMeetingsByContact(
    config: HubSpotConfig,
    contactId: string,
): Promise<HubSpotMeeting[]> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/meetings`,
            {
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                },
            }
        );

        if (!response.ok) return [];

        const assocData = await response.json();
        const meetingIds: string[] = (assocData.results || []).map((a: { id: string }) => a.id);

        if (meetingIds.length === 0) return [];

        // Fetch meeting details in batch
        const batchResponse = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/meetings/batch/read`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: meetingIds.map(id => ({ id })),
                    properties: ['hs_timestamp', 'hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_meeting_outcome'],
                }),
            }
        );

        if (!batchResponse.ok) return [];

        const batchData = await batchResponse.json();
        return (batchData.results || []) as HubSpotMeeting[];
    } catch (error) {
        console.error('HubSpot getMeetingsByContact error:', error);
        return [];
    }
}

/**
 * High-level meeting booking: upsert contact then create meeting.
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
        // Find or create contact
        const upsertResult = await upsertContact(config, params.phoneNumber, {
            firstName: params.contactName?.split(' ')[0],
            lastName: params.contactName?.split(' ').slice(1).join(' ') || undefined,
        });

        if (!upsertResult.success || !upsertResult.contactId) {
            return { success: false, error: 'Failed to book meeting' };
        }

        // Create meeting
        const meetingResult = await createMeeting(config, {
            contactId: upsertResult.contactId,
            title: params.title,
            startTime: params.startTime,
            endTime: params.endTime,
            description: params.description,
        });

        if (!meetingResult.success) {
            return { success: false, contactId: upsertResult.contactId, error: 'Failed to book meeting' };
        }

        return {
            success: true,
            meetingId: meetingResult.meetingId,
            contactId: upsertResult.contactId,
        };
    } catch (error) {
        console.error('HubSpot bookNextAvailableMeeting error:', error);
        return { success: false, error: 'Failed to book meeting' };
    }
}

// ============================================
// Workflow Functions
// ============================================

/**
 * Enroll a contact in a HubSpot workflow.
 */
export async function triggerWorkflow(
    config: HubSpotConfig,
    contactId: string,
    workflowId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/automation/v4/flows/${workflowId}/enrollments`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    objectId: contactId,
                    objectType: 'CONTACT',
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HubSpot trigger workflow error:', errorText);
            return { success: false, error: 'Failed to trigger workflow' };
        }

        return { success: true };
    } catch (error) {
        console.error('HubSpot triggerWorkflow error:', error);
        return { success: false, error: 'Failed to trigger workflow' };
    }
}

// ============================================
// Token Management
// ============================================

// Singleton promise to prevent concurrent refresh attempts
// (HubSpot refresh tokens are single-use)
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Get a valid access token, refreshing if expired.
 * Uses a singleton promise to prevent concurrent refresh races.
 * Returns null if refresh fails or tokens are not configured.
 */
export async function getValidAccessToken(
    config: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
    },
    updateTokens?: (newTokens: { accessToken: string; refreshToken: string; expiresAt: number }) => Promise<void>,
): Promise<string | null> {
    if (!config.access_token) return null;

    // Check if token is still valid (with 5-minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (config.expires_at && Date.now() + bufferMs < config.expires_at) {
        return config.access_token;
    }

    // Token is expired or about to expire, try to refresh
    if (!config.refresh_token) return null;

    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('HubSpot client credentials not configured for token refresh');
        return null;
    }

    // Use singleton promise to prevent concurrent refresh token consumption
    if (_refreshPromise) {
        return _refreshPromise;
    }

    _refreshPromise = (async () => {
        try {
            const refreshed = await refreshAccessToken(clientId!, clientSecret!, config.refresh_token!);
            if (!refreshed) return null;

            // Update stored tokens
            if (updateTokens) {
                await updateTokens({
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    expiresAt: Date.now() + refreshed.expiresIn * 1000,
                });
            }

            return refreshed.accessToken;
        } catch (error) {
            console.error('HubSpot token refresh error:', error);
            return null;
        } finally {
            _refreshPromise = null;
        }
    })();

    return _refreshPromise;
}
