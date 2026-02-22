/**
 * GoHighLevel API Client
 * 
 * Uses GHL API v2 for contact lookup and note creation
 * Docs: https://highlevel.stoplight.io/
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// --- Token Refresh (OAuth) ---

let _refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh a GHL OAuth access token.
 * GHL refresh tokens are single-use (like HubSpot) — a new pair is returned.
 */
async function refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    try {
        const response = await fetch(`${GHL_API_BASE}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                user_type: 'Location',
            }),
        });

        if (!response.ok) {
            console.error('GHL token refresh failed:', response.status);
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
        };
    } catch (error) {
        console.error('GHL token refresh error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Get a valid access token, refreshing if expired.
 * Uses a singleton promise to prevent concurrent refresh races.
 * GHL refresh tokens are single-use — must persist both new access + refresh tokens.
 */
export async function getValidAccessToken(
    config: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
    },
    updateTokens?: (newTokens: { accessToken: string; refreshToken: string; expiresAt: number }) => Promise<void>
): Promise<string | null> {
    if (!config.access_token) return null;

    // Check if token is still valid (with 5-minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (config.expires_at && Date.now() + bufferMs < config.expires_at) {
        return config.access_token;
    }

    // Token is expired or about to expire, try to refresh
    if (!config.refresh_token) return null;

    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('GHL client credentials not configured for token refresh');
        return null;
    }

    // Use singleton promise to prevent concurrent refresh token consumption
    if (_refreshPromise) {
        return _refreshPromise;
    }

    _refreshPromise = (async () => {
        try {
            const refreshed = await refreshAccessToken(clientId, clientSecret, config.refresh_token!);
            if (!refreshed) return null;

            // Persist new tokens (refresh token is single-use, must store the new one)
            if (updateTokens) {
                await updateTokens({
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    expiresAt: Date.now() + refreshed.expiresIn * 1000,
                });
            }

            return refreshed.accessToken;
        } catch (error) {
            console.error('GHL token refresh error:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    })().finally(() => {
        _refreshPromise = null;
    });

    return _refreshPromise;
}

// --- Types ---

interface GHLConfig {
    apiKey: string;
    locationId: string;
}

interface GHLContact {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
}

interface GHLContactSearchResponse {
    contacts: GHLContact[];
    total: number;
}

interface GHLCreateNoteResponse {
    id: string;
    body: string;
    userId?: string;
    dateAdded: string;
}

/**
 * Search for a contact by phone number
 */
export async function searchContactByPhone(
    config: GHLConfig,
    phoneNumber: string
): Promise<GHLContact | null> {
    try {
        // Normalize phone number (remove +, spaces, etc.)
        const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');

        const searchUrl = new URL(`${GHL_API_BASE}/contacts/`);
        searchUrl.searchParams.set('locationId', config.locationId);
        searchUrl.searchParams.set('query', normalizedPhone);

        const response = await fetch(
            searchUrl.toString(),
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            }
        );

        if (!response.ok) {
            console.error('GHL search contact error:', response.status);
            return null;
        }

        const data: GHLContactSearchResponse = await response.json();

        // Return first matching contact
        if (data.contacts && data.contacts.length > 0) {
            return data.contacts[0];
        }

        return null;
    } catch (error) {
        console.error('GHL searchContactByPhone error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Create a new contact in GHL
 */
export async function createContact(
    config: GHLConfig,
    contact: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        source?: string;
        tags?: string[];
    }
): Promise<GHLContact | null> {
    try {
        const response = await fetch(
            `${GHL_API_BASE}/contacts/`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
                body: JSON.stringify({
                    locationId: config.locationId,
                    firstName: contact.firstName || 'Unknown',
                    lastName: contact.lastName,
                    phone: contact.phone,
                    email: contact.email,
                    source: contact.source || 'BuildVoiceAI Call',
                    tags: contact.tags || ['ai-voice-call'],
                }),
            }
        );

        if (!response.ok) {
            console.error('GHL create contact error:', response.status);
            return null;
        }

        const data = await response.json();
        return data.contact;
    } catch (error) {
        console.error('GHL createContact error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Add a note to a contact
 */
export async function addNoteToContact(
    config: GHLConfig,
    contactId: string,
    noteBody: string
): Promise<GHLCreateNoteResponse | null> {
    try {
        const response = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}/notes`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
                body: JSON.stringify({
                    body: noteBody,
                }),
            }
        );

        if (!response.ok) {
            console.error('GHL add note error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('GHL addNoteToContact error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Log an AI voice call to a GHL contact
 * - Finds or creates contact by phone
 * - Adds call note with summary and transcript
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
    }
): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
        if (!config.apiKey || !config.locationId) {
            return { success: false, error: 'GHL not configured' };
        }

        // Find or create contact
        let contact = await searchContactByPhone(config, callData.phoneNumber);

        if (!contact) {
            contact = await createContact(config, {
                phone: callData.phoneNumber,
                source: 'BuildVoiceAI Call',
                tags: ['ai-voice-call'],
            });
        }

        if (!contact) {
            return { success: false, error: 'Failed to find or create contact' };
        }

        // Format call duration
        const minutes = Math.floor(callData.durationSeconds / 60);
        const seconds = callData.durationSeconds % 60;
        const durationStr = `${minutes}m ${seconds}s`;

        // Build note content
        let noteContent = `📞 AI Voice Call (${callData.direction})\n`;
        noteContent += `⏱️ Duration: ${durationStr}\n`;

        if (callData.agentName) {
            noteContent += `🤖 Agent: ${callData.agentName}\n`;
        }

        if (callData.sentiment) {
            noteContent += `😊 Sentiment: ${callData.sentiment}\n`;
        }

        noteContent += '\n';

        if (callData.summary) {
            noteContent += `📝 Summary:\n${callData.summary}\n\n`;
        }

        if (callData.recordingUrl) {
            noteContent += `🎙️ Recording: ${callData.recordingUrl}\n\n`;
        }

        if (callData.transcript) {
            // Truncate transcript if too long (GHL has limits)
            const maxTranscriptLength = 2000;
            const transcript = callData.transcript.length > maxTranscriptLength
                ? callData.transcript.slice(0, maxTranscriptLength) + '...(truncated)'
                : callData.transcript;
            noteContent += `💬 Transcript:\n${transcript}`;
        }

        // Add note to contact
        const note = await addNoteToContact(config, contact.id, noteContent);

        if (!note) {
            return { success: false, contactId: contact.id, error: 'Failed to add note' };
        }

        return { success: true, contactId: contact.id };
    } catch (error) {
        console.error('logCallToGHL error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to log call to GHL' };
    }
}

/**
 * Update tags on a contact — fetches existing tags and merges to avoid overwrites
 */
export async function updateContactTags(
    config: GHLConfig,
    contactId: string,
    tagsToAdd: string[],
    tagsToRemove: string[] = []
): Promise<{ success: boolean; error?: string }> {
    try {
        // Fetch existing contact to get current tags
        const getResponse = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            }
        );

        let existingTags: string[] = [];
        if (getResponse.ok) {
            const contactData = await getResponse.json();
            existingTags = contactData.contact?.tags || [];
        }

        // Merge: add new tags, remove specified tags, deduplicate
        const mergedTags = [...new Set([...existingTags, ...tagsToAdd])];
        const finalTags = tagsToRemove.length > 0
            ? mergedTags.filter(t => !tagsToRemove.includes(t))
            : mergedTags;

        const response = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
                body: JSON.stringify({
                    tags: finalTags,
                }),
            }
        );

        if (!response.ok) {
            console.error('GHL update tags error:', response.status);
            return { success: false, error: 'Failed to update contact tags' };
        }

        return { success: true };
    } catch (error) {
        console.error('GHL updateContactTags error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update contact tags' };
    }
}

/**
 * Get pipelines for the location
 */
export async function getPipelines(
    config: GHLConfig
): Promise<{ id: string; name: string; stages: { id: string; name: string }[] }[]> {
    try {
        const pipelinesUrl = new URL(`${GHL_API_BASE}/opportunities/pipelines`);
        pipelinesUrl.searchParams.set('locationId', config.locationId);

        const response = await fetch(
            pipelinesUrl.toString(),
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            }
        );

        if (!response.ok) {
            console.error('GHL get pipelines error:', response.status);
            return [];
        }

        const data = await response.json();
        return data.pipelines || [];
    } catch (error) {
        console.error('GHL getPipelines error:', error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}

/**
 * Create or update an opportunity (pipeline stage) for a contact
 */
export async function updateContactPipeline(
    config: GHLConfig,
    contactId: string,
    pipelineId: string,
    stageId: string,
    opportunityName?: string
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
    try {
        // First, check if contact has an existing opportunity in this pipeline
        const oppSearchUrl = new URL(`${GHL_API_BASE}/opportunities/search`);
        oppSearchUrl.searchParams.set('locationId', config.locationId);
        oppSearchUrl.searchParams.set('contactId', contactId);
        oppSearchUrl.searchParams.set('pipelineId', pipelineId);

        const searchResponse = await fetch(
            oppSearchUrl.toString(),
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            }
        );

        let existingOpportunityId: string | null = null;
        if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.opportunities && searchData.opportunities.length > 0) {
                existingOpportunityId = searchData.opportunities[0].id;
            }
        }

        if (existingOpportunityId) {
            // Update existing opportunity
            const updateResponse = await fetch(
                `${GHL_API_BASE}/opportunities/${existingOpportunityId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'Version': '2021-07-28',
                    },
                    body: JSON.stringify({
                        pipelineStageId: stageId,
                    }),
                }
            );

            if (!updateResponse.ok) {
                console.error('GHL update opportunity error:', updateResponse.status);
                return { success: false, error: 'Failed to update pipeline' };
            }

            return { success: true, opportunityId: existingOpportunityId };
        } else {
            // Create new opportunity
            const createResponse = await fetch(
                `${GHL_API_BASE}/opportunities/`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'Version': '2021-07-28',
                    },
                    body: JSON.stringify({
                        locationId: config.locationId,
                        contactId,
                        pipelineId,
                        pipelineStageId: stageId,
                        name: opportunityName || 'AI Voice Call Lead',
                        status: 'open',
                    }),
                }
            );

            if (!createResponse.ok) {
                console.error('GHL create opportunity error:', createResponse.status);
                return { success: false, error: 'Failed to update pipeline' };
            }

            const data = await createResponse.json();
            return { success: true, opportunityId: data.opportunity?.id };
        }
    } catch (error) {
        console.error('GHL updateContactPipeline error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update pipeline' };
    }
}

/**
 * Update a custom field on a contact
 */
export async function updateContactCustomField(
    config: GHLConfig,
    contactId: string,
    fieldKey: string,
    value: string | number
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
                body: JSON.stringify({
                    customFields: [
                        {
                            key: fieldKey,
                            value: String(value),
                        },
                    ],
                }),
            }
        );

        if (!response.ok) {
            console.error('GHL update custom field error:', response.status);
            return { success: false, error: 'Failed to update custom field' };
        }

        return { success: true };
    } catch (error) {
        console.error('GHL updateContactCustomField error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update custom field' };
    }
}

// Re-export shared pure functions for backward compatibility
export { calculateAutoTags, calculateLeadScore } from './shared';

// ============================================
// Calendar & Appointment Functions
// ============================================

export interface GHLCalendar {
    id: string;
    name: string;
    description?: string;
    locationId: string;
    teamMembers?: { userId: string; priority?: number }[];
}

export interface GHLTimeSlot {
    startTime: string; // ISO timestamp
    endTime: string;   // ISO timestamp
}

export interface GHLAppointment {
    id: string;
    calendarId: string;
    contactId: string;
    title?: string;
    startTime: string;
    endTime: string;
    status: 'confirmed' | 'showed' | 'noshow' | 'cancelled' | 'invalid' | 'new';
    assignedUserId?: string;
    address?: string;
    notes?: string;
}

/**
 * Get all calendars for a location
 */
export async function getCalendars(
    config: GHLConfig
): Promise<GHLCalendar[]> {
    try {
        const calendarsUrl = new URL(`${GHL_API_BASE}/calendars/`);
        calendarsUrl.searchParams.set('locationId', config.locationId);

        const response = await fetch(
            calendarsUrl.toString(),
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            }
        );

        if (!response.ok) {
            console.error('GHL get calendars error:', response.status);
            return [];
        }

        const data = await response.json();
        return data.calendars || [];
    } catch (error) {
        console.error('GHL getCalendars error:', error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}

/**
 * Get free slots for a calendar between a date range
 */
export async function getCalendarFreeSlots(
    config: GHLConfig,
    calendarId: string,
    startDate: Date,
    endDate: Date,
    timezone?: string
): Promise<Record<string, GHLTimeSlot[]>> {
    try {
        // Convert dates to milliseconds for API
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();

        const slotsUrl = new URL(`${GHL_API_BASE}/calendars/${calendarId}/free-slots`);
        slotsUrl.searchParams.set('startDate', String(startTimestamp));
        slotsUrl.searchParams.set('endDate', String(endTimestamp));
        if (timezone) {
            slotsUrl.searchParams.set('timezone', timezone);
        }

        const response = await fetch(slotsUrl.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28',
            },
        });

        if (!response.ok) {
            console.error('GHL get free slots error:', response.status);
            return {};
        }

        const data = await response.json();
        // Response format: { "2024-01-15": [{ startTime, endTime }, ...], ... }
        return data || {};
    } catch (error) {
        console.error('GHL getCalendarFreeSlots error:', error instanceof Error ? error.message : 'Unknown error');
        return {};
    }
}

/**
 * Get the next available slot from a calendar
 */
export async function getNextAvailableSlot(
    config: GHLConfig,
    calendarId: string,
    daysAhead: number = 7,
    timezone?: string
): Promise<GHLTimeSlot | null> {
    try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + daysAhead);

        const slots = await getCalendarFreeSlots(config, calendarId, startDate, endDate, timezone);

        // Find the first available slot across all dates
        const sortedDates = Object.keys(slots).sort();
        for (const date of sortedDates) {
            const daySlots = slots[date];
            if (daySlots && daySlots.length > 0) {
                // Return the first slot of the earliest available date
                return daySlots[0];
            }
        }

        return null;
    } catch (error) {
        console.error('GHL getNextAvailableSlot error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Create an appointment in a calendar
 */
export async function createAppointment(
    config: GHLConfig,
    appointment: {
        calendarId: string;
        contactId: string;
        startTime: string;      // ISO timestamp
        endTime?: string;       // ISO timestamp (optional, will default to 30 min after start)
        title?: string;
        status?: 'confirmed' | 'new';
        assignedUserId?: string;
        address?: string;
        notes?: string;
        timezone?: string;
        toNotify?: boolean;     // Whether to trigger automations
    }
): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    try {
        // Calculate end time if not provided (default 30 minutes)
        let endTime = appointment.endTime;
        if (!endTime) {
            const startDate = new Date(appointment.startTime);
            startDate.setMinutes(startDate.getMinutes() + 30);
            endTime = startDate.toISOString();
        }

        const response = await fetch(
            `${GHL_API_BASE}/calendars/events/appointments`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-04-15',
                },
                body: JSON.stringify({
                    calendarId: appointment.calendarId,
                    locationId: config.locationId,
                    contactId: appointment.contactId,
                    startTime: appointment.startTime,
                    endTime: endTime,
                    title: appointment.title || 'AI Voice Call Follow-up',
                    appointmentStatus: appointment.status || 'new',
                    assignedUserId: appointment.assignedUserId,
                    address: appointment.address,
                    toNotify: appointment.toNotify !== false, // Default to true
                }),
            }
        );

        if (!response.ok) {
            console.error('GHL create appointment error:', response.status);
            return { success: false, error: 'Failed to create appointment' };
        }

        const data = await response.json();
        return { success: true, appointmentId: data.id || data.appointment?.id };
    } catch (error) {
        console.error('GHL createAppointment error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to create appointment' };
    }
}

/**
 * Update an existing appointment
 */
export async function updateAppointment(
    config: GHLConfig,
    appointmentId: string,
    updates: {
        startTime?: string;
        endTime?: string;
        title?: string;
        status?: 'confirmed' | 'showed' | 'noshow' | 'cancelled' | 'invalid' | 'new';
        assignedUserId?: string;
        address?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${GHL_API_BASE}/calendars/events/appointments/${appointmentId}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-04-15',
                },
                body: JSON.stringify(updates),
            }
        );

        if (!response.ok) {
            console.error('GHL update appointment error:', response.status);
            return { success: false, error: 'Failed to update appointment' };
        }

        return { success: true };
    } catch (error) {
        console.error('GHL updateAppointment error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update appointment' };
    }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(
    config: GHLConfig,
    appointmentId: string
): Promise<{ success: boolean; error?: string }> {
    return updateAppointment(config, appointmentId, { status: 'cancelled' });
}

/**
 * Get an appointment by ID
 */
export async function getAppointment(
    config: GHLConfig,
    appointmentId: string
): Promise<GHLAppointment | null> {
    try {
        const response = await fetch(
            `${GHL_API_BASE}/calendars/events/appointments/${appointmentId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-04-15',
                },
            }
        );

        if (!response.ok) {
            console.error('GHL get appointment error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('GHL getAppointment error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Book an appointment for a contact using the next available slot
 * This is a high-level function that:
 * 1. Finds or creates a contact by phone
 * 2. Gets the next available calendar slot
 * 3. Creates an appointment
 */
export async function bookNextAvailableAppointment(
    config: GHLConfig,
    params: {
        phoneNumber: string;
        calendarId: string;
        title?: string;
        daysAhead?: number;
        timezone?: string;
        appointmentDurationMinutes?: number;
        notes?: string;
    }
): Promise<{ success: boolean; appointmentId?: string; contactId?: string; startTime?: string; error?: string }> {
    try {
        // Find or create contact
        let contact = await searchContactByPhone(config, params.phoneNumber);
        if (!contact) {
            contact = await createContact(config, {
                phone: params.phoneNumber,
                source: 'BuildVoiceAI Call',
                tags: ['ai-voice-call', 'appointment-booked'],
            });
        }

        if (!contact) {
            return { success: false, error: 'Failed to find or create contact' };
        }

        // Get next available slot
        const nextSlot = await getNextAvailableSlot(
            config,
            params.calendarId,
            params.daysAhead || 7,
            params.timezone
        );

        if (!nextSlot) {
            return { success: false, contactId: contact.id, error: 'No available slots found' };
        }

        // Calculate end time based on duration (default 30 minutes)
        const duration = params.appointmentDurationMinutes || 30;
        const startDate = new Date(nextSlot.startTime);
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + duration);

        // Create appointment
        const result = await createAppointment(config, {
            calendarId: params.calendarId,
            contactId: contact.id,
            startTime: nextSlot.startTime,
            endTime: endDate.toISOString(),
            title: params.title || 'AI Voice Call Follow-up',
            status: 'confirmed',
            timezone: params.timezone,
            notes: params.notes,
        });

        if (!result.success) {
            return { success: false, contactId: contact.id, error: 'Failed to book appointment' };
        }

        return {
            success: true,
            appointmentId: result.appointmentId,
            contactId: contact.id,
            startTime: nextSlot.startTime,
        };
    } catch (error) {
        console.error('GHL bookNextAvailableAppointment error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to book appointment' };
    }
}

// ============================================
// Enhanced Contact Management (Inbound Receptionist)
// ============================================

/**
 * Upsert a contact: find by phone, create if not found, update with provided data.
 * Returns the contact ID and whether it was newly created.
 */
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
    }
): Promise<{ success: boolean; contactId?: string; isNew?: boolean; error?: string }> {
    try {
        // Search for existing contact
        let contact = await searchContactByPhone(config, phoneNumber);
        let isNew = false;

        if (!contact) {
            // Create new contact
            contact = await createContact(config, {
                phone: phoneNumber,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                source: data.source || 'BuildVoiceAI Call',
                tags: data.tags || ['ai-voice-call'],
            });
            isNew = true;

            if (!contact) {
                return { success: false, error: 'Failed to create contact' };
            }
        }

        // Update existing contact with new data if provided
        if (!isNew && (data.tags || data.customFields || data.firstName || data.lastName)) {
            const updates: Record<string, unknown> = {};

            if (data.firstName) updates.firstName = data.firstName;
            if (data.lastName) updates.lastName = data.lastName;
            if (data.email) updates.email = data.email;

            // Merge tags
            if (data.tags && data.tags.length > 0) {
                const existingTags = contact.tags || [];
                updates.tags = [...new Set([...existingTags, ...data.tags])];
            }

            // Custom fields
            if (data.customFields && data.customFields.length > 0) {
                updates.customFields = data.customFields.map(f => ({
                    key: f.key,
                    value: f.value,
                }));
            }

            if (Object.keys(updates).length > 0) {
                const updateRes = await fetch(
                    `${GHL_API_BASE}/contacts/${contact.id}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${config.apiKey}`,
                            'Content-Type': 'application/json',
                            'Version': '2021-07-28',
                        },
                        body: JSON.stringify(updates),
                    }
                );
                if (!updateRes.ok) {
                    console.error('GHL update contact error:', updateRes.status);
                    return { success: false, error: 'Failed to update contact' };
                }
            }
        }

        return { success: true, contactId: contact.id, isNew };
    } catch (error) {
        console.error('GHL upsertContact error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to upsert contact' };
    }
}

/**
 * Update a contact with multiple fields at once
 */
export async function updateContact(
    config: GHLConfig,
    contactId: string,
    updates: {
        firstName?: string;
        lastName?: string;
        email?: string;
        tags?: string[];
        customFields?: { key: string; value: string }[];
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const body: Record<string, unknown> = {};

        if (updates.firstName) body.firstName = updates.firstName;
        if (updates.lastName) body.lastName = updates.lastName;
        if (updates.email) body.email = updates.email;
        if (updates.tags) body.tags = updates.tags;
        if (updates.customFields) {
            body.customFields = updates.customFields.map(f => ({
                key: f.key,
                value: f.value,
            }));
        }

        const response = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            console.error('GHL update contact error:', response.status);
            return { success: false, error: 'Failed to update contact' };
        }

        return { success: true };
    } catch (error) {
        console.error('GHL updateContact error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to update contact' };
    }
}

/**
 * Trigger a GHL workflow for a contact.
 * Used for post-call follow-ups (SMS, email sequences, etc.)
 */
export async function triggerContactWorkflow(
    config: GHLConfig,
    contactId: string,
    workflowId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}/workflow/${workflowId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
                body: JSON.stringify({}),
            }
        );

        if (!response.ok) {
            console.error('GHL trigger workflow error:', response.status);
            return { success: false, error: 'Failed to trigger workflow' };
        }

        return { success: true };
    } catch (error) {
        console.error('GHL triggerContactWorkflow error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to trigger workflow' };
    }
}

/**
 * Add a rich formatted call note to a contact.
 * Enhanced version with configurable template.
 */
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
    options?: {
        includeTranscript?: boolean;
        maxTranscriptLength?: number;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const minutes = Math.floor(callData.durationSeconds / 60);
        const seconds = callData.durationSeconds % 60;
        const durationStr = `${minutes}m ${seconds}s`;

        let noteContent = `AI Voice Call (${callData.direction})\n`;
        noteContent += `Duration: ${durationStr}\n`;

        if (callData.agentName) {
            noteContent += `Agent: ${callData.agentName}\n`;
        }

        if (callData.sentiment) {
            noteContent += `Sentiment: ${callData.sentiment}\n`;
        }

        if (callData.leadTimezone) {
            noteContent += `Lead Timezone: ${callData.leadTimezone}\n`;
        }

        if (callData.topics && callData.topics.length > 0) {
            noteContent += `Topics: ${callData.topics.join(', ')}\n`;
        }

        noteContent += '\n';

        if (callData.summary) {
            noteContent += `Summary:\n${callData.summary}\n\n`;
        }

        if (callData.recordingUrl) {
            noteContent += `Recording: ${callData.recordingUrl}\n\n`;
        }

        if (options?.includeTranscript !== false && callData.transcript) {
            const maxLen = options?.maxTranscriptLength ?? 2000;
            const transcript = callData.transcript.length > maxLen
                ? callData.transcript.slice(0, maxLen) + '...(truncated)'
                : callData.transcript;
            noteContent += `Transcript:\n${transcript}`;
        }

        const result = await addNoteToContact(config, contactId, noteContent);

        return result
            ? { success: true }
            : { success: false, error: 'Failed to add note' };
    } catch (error) {
        console.error('GHL addCallNoteToContact error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to add call note' };
    }
}
