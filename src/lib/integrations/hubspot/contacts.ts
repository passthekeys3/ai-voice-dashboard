/**
 * HubSpot contact operations.
 *
 * Covers CRUD, tag management, notes, call engagements, and the
 * high-level logCallToHubSpot orchestrator used by the webhook pipeline.
 */

import type { HubSpotConfig, HubSpotContact } from './shared';
import { hubspotFetch } from './shared';

// ── Search ───────────────────────────────────────────────

/** Properties requested on every contact search. */
const SEARCH_PROPERTIES = ['firstname', 'lastname', 'email', 'phone', 'hs_lead_status', 'ai_call_tags'];

/** Shared search — both phone and email searches are identical except the filter. */
async function searchContacts(
    config: HubSpotConfig,
    field: string,
    operator: string,
    value: string,
): Promise<HubSpotContact | null> {
    const data = await hubspotFetch<{ results: HubSpotContact[] }>(
        config,
        '/crm/v3/objects/contacts/search',
        {
            method: 'POST',
            body: {
                filterGroups: [{ filters: [{ propertyName: field, operator, value }] }],
                properties: SEARCH_PROPERTIES,
                limit: 1,
            },
        },
    );
    return data?.results?.[0] ?? null;
}

/** Search for a contact by phone number. Uses CONTAINS_TOKEN for partial match. */
export async function searchContactByPhone(
    config: HubSpotConfig,
    phoneNumber: string,
): Promise<HubSpotContact | null> {
    // Strip non-digits except leading + (HubSpot search wants digits only)
    const normalized = phoneNumber.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    return searchContacts(config, 'phone', 'CONTAINS_TOKEN', normalized);
}

/** Search for a contact by email address. Uses exact EQ match. */
export async function searchContactByEmail(
    config: HubSpotConfig,
    email: string,
): Promise<HubSpotContact | null> {
    return searchContacts(config, 'email', 'EQ', email.toLowerCase());
}

// ── Create / Update ──────────────────────────────────────

/** Create a new CRM contact. Returns the created contact or null on failure. */
export async function createContact(
    config: HubSpotConfig,
    contact: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        leadStatus?: string;
    },
): Promise<HubSpotContact | null> {
    const properties: Record<string, string> = {};
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName) properties.lastname = contact.lastName;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.email) properties.email = contact.email;
    properties.hs_lead_status = contact.leadStatus || 'NEW';

    const data = await hubspotFetch<{ id: string; properties: Record<string, string> }>(
        config,
        '/crm/v3/objects/contacts',
        { method: 'POST', body: { properties } },
    );

    return data ? { id: data.id, properties: data.properties } : null;
}

/** Update one or more properties on an existing contact. */
export async function updateContact(
    config: HubSpotConfig,
    contactId: string,
    properties: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
    const result = await hubspotFetch(
        config,
        `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`,
        { method: 'PATCH', body: { properties } },
    );
    return result ? { success: true } : { success: false, error: 'Failed to update HubSpot contact' };
}

/** Convenience: update a single property by name. */
export async function updateContactProperty(
    config: HubSpotConfig,
    contactId: string,
    propertyName: string,
    value: string | number,
): Promise<{ success: boolean; error?: string }> {
    return updateContact(config, contactId, { [propertyName]: String(value) });
}

// ── Upsert ───────────────────────────────────────────────

/**
 * Find-or-create a contact by phone, then merge in any additional data.
 * Used by webhook pipeline and high-level booking functions.
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
): Promise<{ success: boolean; contactId?: string; isNew?: boolean; error?: string; warning?: string }> {
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

        // Build property updates
        const updates: Record<string, string> = {};
        if (data?.firstName && (isNew || data.firstName !== 'Unknown')) updates.firstname = data.firstName;
        if (data?.lastName) updates.lastname = data.lastName;
        if (data?.email) updates.email = data.email;
        if (data?.source) updates.hs_analytics_source = data.source;
        if (data?.properties) Object.assign(updates, data.properties);

        // Merge tags into the semicolon-separated ai_call_tags custom property
        if (data?.tags && data.tags.length > 0) {
            const existingTags = contact.properties.ai_call_tags?.split(';').filter(Boolean) || [];
            const sanitized = data.tags.map(t => t.replace(/;/g, '').trim()).filter(Boolean);
            updates.ai_call_tags = [...new Set([...existingTags, ...sanitized])].join(';');
        }

        if (Object.keys(updates).length > 0) {
            const updateResult = await updateContact(config, contact.id, updates);
            if (!updateResult.success) {
                // Contact exists but update failed — partial success
                return { success: true, contactId: contact.id, isNew, warning: 'Contact exists but property update failed' };
            }
        }

        return { success: true, contactId: contact.id, isNew };
    } catch (error) {
        console.error('HubSpot upsertContact error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to upsert HubSpot contact' };
    }
}

// ── Tags ─────────────────────────────────────────────────

/**
 * Merge tags into the ai_call_tags custom property.
 * Fetches existing tags first to avoid overwrites.
 */
export async function updateContactTags(
    config: HubSpotConfig,
    contactId: string,
    tags: string[],
): Promise<{ success: boolean; error?: string }> {
    // Fetch current tags
    let existingTags: string[] = [];
    const contactData = await hubspotFetch<{ properties: { ai_call_tags?: string } }>(
        config,
        `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`,
        { query: 'properties=ai_call_tags' },
    );
    if (contactData) {
        existingTags = contactData.properties?.ai_call_tags?.split(';').filter(Boolean) || [];
    }

    const sanitized = tags.map(t => t.replace(/;/g, '').trim()).filter(Boolean);
    const merged = [...new Set([...existingTags, ...sanitized])];

    return updateContact(config, contactId, { ai_call_tags: merged.join(';') });
}

// ── Notes ────────────────────────────────────────────────

/**
 * Add a note to a contact via the CRM Notes object.
 * Uses associationTypeId 202 (Note → Contact).
 */
export async function addNoteToContact(
    config: HubSpotConfig,
    contactId: string,
    noteBody: string,
): Promise<{ success: boolean; noteId?: string; error?: string }> {
    const data = await hubspotFetch<{ id: string }>(config, '/crm/v3/objects/notes', {
        method: 'POST',
        body: {
            properties: {
                hs_timestamp: new Date().toISOString(),
                hs_note_body: noteBody,
            },
            associations: [{
                to: { id: contactId },
                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
            }],
        },
    });

    return data
        ? { success: true, noteId: data.id }
        : { success: false, error: 'Failed to add note to contact' };
}

/**
 * Add a formatted call-summary note to a contact.
 * Matches the GHL addCallNoteToContact format for consistency.
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
    if (callData.topics?.length) lines.push(`Topics: ${callData.topics.join(', ')}`);
    if (callData.summary) lines.push('', 'Summary:', callData.summary);
    if (options?.includeRecording !== false && callData.recording_url) {
        lines.push('', `Recording: ${callData.recording_url}`);
    }
    if (options?.includeTranscript !== false && callData.transcript) {
        const truncated = callData.transcript.length > maxLen
            ? callData.transcript.slice(0, maxLen) + '...(truncated)'
            : callData.transcript;
        lines.push('', 'Transcript:', truncated);
    }

    return addNoteToContact(config, contactId, lines.join('\n'));
}

// ── Call Engagements ─────────────────────────────────────

/**
 * Create a Call engagement and associate it with a contact.
 * Uses associationTypeId 194 (Call → Contact).
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
    },
): Promise<{ success: boolean; callId?: string; error?: string }> {
    const data = await hubspotFetch<{ id: string }>(config, '/crm/v3/objects/calls', {
        method: 'POST',
        body: {
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
                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 194 }],
            }],
        },
    });

    return data
        ? { success: true, callId: data.id }
        : { success: false, error: 'Failed to create call engagement' };
}

// ── High-level Call Logger ───────────────────────────────

/** Format seconds into "Xm Ys" string. */
function formatDuration(seconds: number): string {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Log an AI voice call to HubSpot end-to-end:
 * 1. Find or create the contact by phone number
 * 2. Create a Call engagement with summary + transcript
 *
 * This is the main entry point used by the webhook post-processing pipeline.
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
    },
): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
        if (!config.accessToken) {
            return { success: false, error: 'HubSpot not configured' };
        }

        // Step 1: Find or create contact
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

        // Step 2: Build call body
        const lines: string[] = [
            `AI Voice Call (${callData.direction})`,
            `Duration: ${formatDuration(callData.durationSeconds)}`,
        ];
        if (callData.agentName) lines.push(`Agent: ${callData.agentName}`);
        if (callData.sentiment) lines.push(`Sentiment: ${callData.sentiment}`);
        lines.push('');
        if (callData.summary) lines.push(`Summary:\n${callData.summary}\n`);
        if (callData.recordingUrl) lines.push(`Recording: ${callData.recordingUrl}\n`);
        if (callData.transcript) {
            const maxLen = 5000;
            const transcript = callData.transcript.length > maxLen
                ? callData.transcript.slice(0, maxLen) + '...(truncated)'
                : callData.transcript;
            lines.push(`Transcript:\n${transcript}`);
        }

        // Step 3: Create call engagement
        const result = await createCallEngagement(config, contact.id, {
            title: `AI Voice Call - ${callData.agentName || 'BuildVoiceAI'}`,
            body: lines.join('\n'),
            direction: callData.direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
            status: callData.durationSeconds > 0 ? 'COMPLETED' : 'NO_ANSWER',
            durationMs: callData.durationSeconds * 1000,
            fromNumber: callData.direction === 'inbound' ? callData.phoneNumber : undefined,
            toNumber: callData.direction === 'outbound' ? callData.phoneNumber : undefined,
            timestamp: callData.startedAt,
        });

        return result.success
            ? { success: true, contactId: contact.id }
            : { success: false, contactId: contact.id, error: 'Failed to log call to HubSpot' };
    } catch (error) {
        console.error('logCallToHubSpot error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to log call to HubSpot' };
    }
}
