/**
 * GHL Contact operations: search, create, update, upsert, tags, custom fields, notes.
 */

import { GHL_API_BASE, type GHLConfig, type GHLContact, ghlFetch } from './shared';

interface GHLContactSearchResponse {
    contacts: GHLContact[];
    total: number;
}

/** Search for a contact by phone number */
export async function searchContactByPhone(
    config: GHLConfig,
    phoneNumber: string,
): Promise<GHLContact | null> {
    const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
    const data = await ghlFetch<GHLContactSearchResponse>(config, '/contacts/', {
        params: { locationId: config.locationId, query: normalizedPhone },
    });
    return data?.contacts?.[0] || null;
}

/** Create a new contact */
export async function createContact(
    config: GHLConfig,
    contact: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        source?: string;
        tags?: string[];
    },
): Promise<GHLContact | null> {
    const data = await ghlFetch<{ contact: GHLContact }>(config, '/contacts/', {
        method: 'POST',
        body: {
            locationId: config.locationId,
            firstName: contact.firstName || 'Unknown',
            lastName: contact.lastName,
            phone: contact.phone,
            email: contact.email,
            source: contact.source || 'BuildVoiceAI Call',
            tags: contact.tags || ['ai-voice-call'],
        },
    });
    return data?.contact || null;
}

/** Update a contact with multiple fields */
export async function updateContact(
    config: GHLConfig,
    contactId: string,
    updates: {
        firstName?: string;
        lastName?: string;
        email?: string;
        tags?: string[];
        customFields?: { key: string; value: string }[];
    },
): Promise<{ success: boolean; error?: string }> {
    const body: Record<string, unknown> = {};
    if (updates.firstName) body.firstName = updates.firstName;
    if (updates.lastName) body.lastName = updates.lastName;
    if (updates.email) body.email = updates.email;
    if (updates.tags) body.tags = updates.tags;
    if (updates.customFields) body.customFields = updates.customFields.map(f => ({ key: f.key, value: f.value }));

    const result = await ghlFetch(config, `/contacts/${encodeURIComponent(contactId)}`, {
        method: 'PUT',
        body,
    });
    return result ? { success: true } : { success: false, error: 'Failed to update contact' };
}

/** Upsert a contact: find by phone, create if missing, update with provided data */
export async function upsertContact(
    config: GHLConfig,
    phoneNumber: string,
    data: {
        firstName?: string;
        lastName?: string;
        email?: string;
        tags?: string[];
        source?: string;
        customFields?: { key: string; value: string }[];
    },
): Promise<{ success: boolean; contactId?: string; isNew?: boolean; error?: string }> {
    try {
        let contact = await searchContactByPhone(config, phoneNumber);
        let isNew = false;

        if (!contact) {
            contact = await createContact(config, {
                phone: phoneNumber,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                source: data.source || 'BuildVoiceAI Call',
                tags: data.tags || ['ai-voice-call'],
            });
            isNew = true;
            if (!contact) return { success: false, error: 'Failed to create contact' };
        }

        // Update existing contact with new data if provided
        if (!isNew && (data.tags || data.customFields || data.firstName || data.lastName)) {
            const updates: Record<string, unknown> = {};
            if (data.firstName) updates.firstName = data.firstName;
            if (data.lastName) updates.lastName = data.lastName;
            if (data.email) updates.email = data.email;
            if (data.tags && data.tags.length > 0) {
                updates.tags = [...new Set([...(contact.tags || []), ...data.tags])];
            }
            if (data.customFields && data.customFields.length > 0) {
                updates.customFields = data.customFields.map(f => ({ key: f.key, value: f.value }));
            }

            if (Object.keys(updates).length > 0) {
                const updateRes = await fetch(
                    `${GHL_API_BASE}/contacts/${encodeURIComponent(contact.id)}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${config.apiKey}`,
                            'Content-Type': 'application/json',
                            'Version': '2021-07-28',
                        },
                        body: JSON.stringify(updates),
                    },
                );
                if (!updateRes.ok) return { success: false, error: 'Failed to update contact' };
            }
        }

        return { success: true, contactId: contact.id, isNew };
    } catch (error) {
        console.error('GHL upsertContact error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to upsert contact' };
    }
}

/** Update tags — fetches existing and merges to avoid overwrites */
export async function updateContactTags(
    config: GHLConfig,
    contactId: string,
    tagsToAdd: string[],
    tagsToRemove: string[] = [],
): Promise<{ success: boolean; error?: string }> {
    try {
        // Fetch existing tags
        const contactData = await ghlFetch<{ contact: GHLContact }>(config, `/contacts/${encodeURIComponent(contactId)}`);
        const existingTags = contactData?.contact?.tags || [];

        // Merge and deduplicate
        const mergedTags = [...new Set([...existingTags, ...tagsToAdd])];
        const finalTags = tagsToRemove.length > 0
            ? mergedTags.filter(t => !tagsToRemove.includes(t))
            : mergedTags;

        const result = await ghlFetch(config, `/contacts/${encodeURIComponent(contactId)}`, {
            method: 'PUT',
            body: { tags: finalTags },
        });
        return result ? { success: true } : { success: false, error: 'Failed to update contact tags' };
    } catch (error) {
        console.error('GHL updateContactTags error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update contact tags' };
    }
}

/** Update a custom field on a contact */
export async function updateContactCustomField(
    config: GHLConfig,
    contactId: string,
    fieldKey: string,
    value: string | number,
): Promise<{ success: boolean; error?: string }> {
    const result = await ghlFetch(config, `/contacts/${encodeURIComponent(contactId)}`, {
        method: 'PUT',
        body: { customFields: [{ key: fieldKey, value: String(value) }] },
    });
    return result ? { success: true } : { success: false, error: 'Failed to update custom field' };
}

/** Add a note to a contact */
export async function addNoteToContact(
    config: GHLConfig,
    contactId: string,
    noteBody: string,
): Promise<{ id: string } | null> {
    return ghlFetch(config, `/contacts/${encodeURIComponent(contactId)}/notes`, {
        method: 'POST',
        body: { body: noteBody },
    });
}

/** Trigger a GHL workflow for a contact */
export async function triggerContactWorkflow(
    config: GHLConfig,
    contactId: string,
    workflowId: string,
): Promise<{ success: boolean; error?: string }> {
    const result = await ghlFetch(config, `/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(workflowId)}`, {
        method: 'POST',
        body: {},
    });
    return result ? { success: true } : { success: false, error: 'Failed to trigger workflow' };
}

/** Add a rich formatted call note to a contact */
export async function addCallNoteToContact(
    config: GHLConfig,
    contactId: string,
    callData: {
        direction: 'inbound' | 'outbound';
        durationSeconds: number;
        agentName?: string;
        summary?: string;
        transcript?: string;
        recordingUrl?: string;
        sentiment?: string;
        topics?: string[];
        leadTimezone?: string;
    },
    options?: { includeTranscript?: boolean; maxTranscriptLength?: number },
): Promise<{ success: boolean; error?: string }> {
    try {
        const mins = Math.floor(callData.durationSeconds / 60);
        const secs = callData.durationSeconds % 60;

        let note = `AI Voice Call (${callData.direction})\nDuration: ${mins}m ${secs}s\n`;
        if (callData.agentName) note += `Agent: ${callData.agentName}\n`;
        if (callData.sentiment) note += `Sentiment: ${callData.sentiment}\n`;
        if (callData.leadTimezone) note += `Lead Timezone: ${callData.leadTimezone}\n`;
        if (callData.topics?.length) note += `Topics: ${callData.topics.join(', ')}\n`;
        note += '\n';
        if (callData.summary) note += `Summary:\n${callData.summary}\n\n`;
        if (callData.recordingUrl) note += `Recording: ${callData.recordingUrl}\n\n`;

        if (options?.includeTranscript !== false && callData.transcript) {
            const maxLen = options?.maxTranscriptLength ?? 2000;
            const transcript = callData.transcript.length > maxLen
                ? callData.transcript.slice(0, maxLen) + '...(truncated)'
                : callData.transcript;
            note += `Transcript:\n${transcript}`;
        }

        const result = await addNoteToContact(config, contactId, note);
        return result ? { success: true } : { success: false, error: 'Failed to add note' };
    } catch (error) {
        console.error('GHL addCallNoteToContact error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to add call note' };
    }
}

/**
 * Log an AI voice call to a GHL contact (find/create + note)
 */
export async function logCallToGHL(
    config: GHLConfig,
    callData: {
        phoneNumber: string;
        direction: 'inbound' | 'outbound';
        durationSeconds: number;
        summary?: string;
        transcript?: string;
        recordingUrl?: string;
        sentiment?: string;
        agentName?: string;
    },
): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
        if (!config.apiKey || !config.locationId) {
            return { success: false, error: 'GHL not configured' };
        }

        let contact = await searchContactByPhone(config, callData.phoneNumber);
        if (!contact) {
            contact = await createContact(config, {
                phone: callData.phoneNumber,
                source: 'BuildVoiceAI Call',
                tags: ['ai-voice-call'],
            });
        }
        if (!contact) return { success: false, error: 'Failed to find or create contact' };

        const result = await addCallNoteToContact(config, contact.id, {
            direction: callData.direction,
            durationSeconds: callData.durationSeconds,
            agentName: callData.agentName,
            summary: callData.summary,
            transcript: callData.transcript,
            recordingUrl: callData.recordingUrl,
            sentiment: callData.sentiment,
        });

        return result.success
            ? { success: true, contactId: contact.id }
            : { success: false, contactId: contact.id, error: result.error };
    } catch (error) {
        console.error('logCallToGHL error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to log call to GHL' };
    }
}
