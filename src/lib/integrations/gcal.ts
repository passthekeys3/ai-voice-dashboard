/**
 * Google Calendar API Client
 *
 * Provides calendar event management and availability checking
 * via Google Calendar API v3.
 *
 * Scopes: calendar.events (read/write events) + calendar.readonly (list calendars, free/busy)
 * Docs: https://developers.google.com/calendar/api/v3/reference
 */

const GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3';

// --- Types ---

export interface GCalConfig {
    accessToken: string;
}

export interface GCalCalendar {
    id: string;
    summary: string;
    description?: string;
    timeZone?: string;
    primary?: boolean;
}

export interface GCalEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    status: 'confirmed' | 'tentative' | 'cancelled';
    attendees?: { email: string; responseStatus?: string }[];
    htmlLink?: string;
}

export interface GCalFreeBusySlot {
    start: string;
    end: string;
}

// --- Token Refresh ---

let refreshPromise: Promise<{ accessToken: string; expiresIn: number } | null> | null = null;

/**
 * Refresh a Google OAuth access token.
 * Google refresh tokens are reusable (unlike HubSpot single-use tokens).
 */
async function refreshAccessToken(
    refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !refreshToken) {
        return null;
    }

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            console.error('Google Calendar token refresh failed:', response.status);
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            expiresIn: data.expires_in,
        };
    } catch (error) {
        console.error('Google Calendar token refresh error:', error);
        return null;
    }
}

/**
 * Get a valid access token, refreshing if needed.
 * Uses singleton promise pattern to prevent concurrent refresh attempts.
 */
export async function getValidAccessToken(
    config: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
    },
    updateTokens?: (newTokens: { accessToken: string; expiresAt: number }) => Promise<void>
): Promise<string | null> {
    if (!config.access_token || !config.refresh_token) {
        return null;
    }

    // Check if token is still valid (with 5-minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (config.expires_at && Date.now() + bufferMs < config.expires_at) {
        return config.access_token;
    }

    // Token expired or about to expire — refresh using singleton pattern
    if (!refreshPromise) {
        refreshPromise = refreshAccessToken(config.refresh_token).finally(() => {
            refreshPromise = null;
        });
    }

    const result = await refreshPromise;
    if (!result) {
        return null;
    }

    // Persist new access token (refresh token stays the same for Google)
    if (updateTokens) {
        try {
            await updateTokens({
                accessToken: result.accessToken,
                expiresAt: Date.now() + result.expiresIn * 1000,
            });
        } catch (error) {
            console.error('Failed to persist refreshed Google Calendar tokens:', error);
        }
    }

    return result.accessToken;
}

// --- Calendar Functions ---

/**
 * List the user's calendars.
 */
export async function listCalendars(
    config: GCalConfig
): Promise<GCalCalendar[]> {
    try {
        const response = await fetch(`${GCAL_API_BASE}/users/me/calendarList`, {
            headers: { Authorization: `Bearer ${config.accessToken}` },
        });

        if (!response.ok) {
            console.error('GCal listCalendars error:', response.status);
            return [];
        }

        const data = await response.json();
        return (data.items || []).map((item: Record<string, unknown>) => ({
            id: item.id as string,
            summary: item.summary as string,
            description: item.description as string | undefined,
            timeZone: item.timeZone as string | undefined,
            primary: item.primary as boolean | undefined,
        }));
    } catch (error) {
        console.error('GCal listCalendars error:', error);
        return [];
    }
}

/**
 * Query free/busy information across one or more calendars.
 */
export async function getFreeBusy(
    config: GCalConfig,
    params: {
        calendarIds: string[];
        timeMin: string;
        timeMax: string;
        timeZone?: string;
    }
): Promise<Record<string, GCalFreeBusySlot[]>> {
    try {
        const response = await fetch(`${GCAL_API_BASE}/freeBusy`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timeMin: params.timeMin,
                timeMax: params.timeMax,
                timeZone: params.timeZone || 'UTC',
                items: params.calendarIds.map(id => ({ id })),
            }),
        });

        if (!response.ok) {
            console.error('GCal getFreeBusy error:', response.status);
            return {};
        }

        const data = await response.json();
        const result: Record<string, GCalFreeBusySlot[]> = {};

        for (const calendarId of params.calendarIds) {
            const calendarData = data.calendars?.[calendarId];
            result[calendarId] = (calendarData?.busy || []) as GCalFreeBusySlot[];
        }

        return result;
    } catch (error) {
        console.error('GCal getFreeBusy error:', error);
        return {};
    }
}

/**
 * Find the next available time slot in a calendar.
 * Searches through business hours across multiple days.
 */
export async function findNextFreeSlot(
    config: GCalConfig,
    params: {
        calendarId: string;
        durationMinutes: number;
        daysAhead?: number;
        startHour?: number;
        endHour?: number;
        timezone?: string;
    }
): Promise<{ start: string; end: string } | null> {
    const {
        calendarId,
        durationMinutes,
        daysAhead = 7,
        startHour = 9,
        endHour = 17,
        timezone = 'UTC',
    } = params;

    // Query free/busy for the search window
    const now = new Date();
    const searchEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const busySlots = await getFreeBusy(config, {
        calendarIds: [calendarId],
        timeMin: now.toISOString(),
        timeMax: searchEnd.toISOString(),
        timeZone: timezone,
    });

    const busy = busySlots[calendarId] || [];

    // Iterate through each day's business hours to find a free slot
    for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
        const day = new Date(now);
        day.setDate(day.getDate() + dayOffset);

        // Set business hours start for this day
        const dayStart = new Date(day);
        dayStart.setHours(startHour, 0, 0, 0);

        // Skip if business hours already passed today
        if (dayOffset === 0 && now > dayStart) {
            // Round up to next 30-minute block
            dayStart.setTime(now.getTime());
            dayStart.setMinutes(Math.ceil(dayStart.getMinutes() / 30) * 30, 0, 0);
        }

        const dayEnd = new Date(day);
        dayEnd.setHours(endHour, 0, 0, 0);

        if (dayStart >= dayEnd) continue;

        // Check each 30-minute increment within business hours
        let candidateStart = new Date(dayStart);
        while (candidateStart.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
            const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60 * 1000);

            // Check if this slot overlaps with any busy period
            const overlaps = busy.some(slot => {
                const busyStart = new Date(slot.start);
                const busyEnd = new Date(slot.end);
                return candidateStart < busyEnd && candidateEnd > busyStart;
            });

            if (!overlaps) {
                return {
                    start: candidateStart.toISOString(),
                    end: candidateEnd.toISOString(),
                };
            }

            // Move forward by 30 minutes
            candidateStart = new Date(candidateStart.getTime() + 30 * 60 * 1000);
        }
    }

    return null;
}

/**
 * Create a calendar event.
 */
export async function createEvent(
    config: GCalConfig,
    params: {
        calendarId: string;
        summary: string;
        description?: string;
        startTime: string;
        endTime: string;
        attendees?: string[];
        timeZone?: string;
    }
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
    try {
        const body: Record<string, unknown> = {
            summary: params.summary,
            description: params.description,
            start: {
                dateTime: params.startTime,
                timeZone: params.timeZone || 'UTC',
            },
            end: {
                dateTime: params.endTime,
                timeZone: params.timeZone || 'UTC',
            },
        };

        if (params.attendees && params.attendees.length > 0) {
            body.attendees = params.attendees.map(email => ({ email }));
        }

        const response = await fetch(
            `${GCAL_API_BASE}/calendars/${encodeURIComponent(params.calendarId)}/events`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            console.error('GCal createEvent error:', response.status);
            return { success: false, error: 'Failed to create calendar event' };
        }

        const event = await response.json();
        return {
            success: true,
            eventId: event.id,
            htmlLink: event.htmlLink,
        };
    } catch (error) {
        console.error('GCal createEvent error:', error);
        return { success: false, error: 'Failed to create calendar event' };
    }
}

/**
 * Cancel (delete) a calendar event.
 */
export async function cancelEvent(
    config: GCalConfig,
    calendarId: string,
    eventId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(
            `${GCAL_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${config.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            console.error('GCal cancelEvent error:', response.status);
            return { success: false, error: 'Failed to cancel calendar event' };
        }

        return { success: true };
    } catch (error) {
        console.error('GCal cancelEvent error:', error);
        return { success: false, error: 'Failed to cancel calendar event' };
    }
}

/**
 * Get a single calendar event by ID.
 */
export async function getEvent(
    config: GCalConfig,
    calendarId: string,
    eventId: string
): Promise<GCalEvent | null> {
    try {
        const response = await fetch(
            `${GCAL_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            {
                headers: { Authorization: `Bearer ${config.accessToken}` },
            }
        );

        if (!response.ok) {
            console.error('GCal getEvent error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('GCal getEvent error:', error);
        return null;
    }
}

/**
 * High-level function: find the next free slot and book an event.
 * Mirrors GHL's bookNextAvailableAppointment pattern.
 */
export async function bookEventWithAvailabilityCheck(
    config: GCalConfig,
    params: {
        calendarId: string;
        summary: string;
        description?: string;
        durationMinutes?: number;
        daysAhead?: number;
        startHour?: number;
        endHour?: number;
        timezone?: string;
        attendeeEmail?: string;
    }
): Promise<{ success: boolean; eventId?: string; startTime?: string; htmlLink?: string; error?: string }> {
    try {
        const slot = await findNextFreeSlot(config, {
            calendarId: params.calendarId,
            durationMinutes: params.durationMinutes || 30,
            daysAhead: params.daysAhead || 7,
            startHour: params.startHour || 9,
            endHour: params.endHour || 17,
            timezone: params.timezone,
        });

        if (!slot) {
            return {
                success: false,
                error: 'No available time slots found in the search window',
            };
        }

        const attendees = params.attendeeEmail ? [params.attendeeEmail] : undefined;

        const result = await createEvent(config, {
            calendarId: params.calendarId,
            summary: params.summary,
            description: params.description,
            startTime: slot.start,
            endTime: slot.end,
            attendees,
            timeZone: params.timezone,
        });

        if (!result.success) {
            return result;
        }

        return {
            success: true,
            eventId: result.eventId,
            startTime: slot.start,
            htmlLink: result.htmlLink,
        };
    } catch (error) {
        console.error('GCal bookEventWithAvailabilityCheck error:', error);
        return { success: false, error: 'Failed to book calendar event' };
    }
}
