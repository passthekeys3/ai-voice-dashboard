/**
 * Calendly Integration — REST API v2
 *
 * Uses Personal Access Token authentication.
 * API docs: https://developer.calendly.com/api-docs
 */

const CALENDLY_API_BASE = 'https://api.calendly.com';

// ============================================================================
// Types
// ============================================================================

export interface CalendlyConfig {
    apiToken: string;
    userUri?: string;
    defaultEventTypeUri?: string;
}

export interface CalendlyUser {
    uri: string;
    name: string;
    email: string;
    scheduling_url: string;
    timezone: string;
    current_organization: string;
}

export interface CalendlyEventType {
    uri: string;
    name: string;
    active: boolean;
    slug: string;
    scheduling_url: string;
    duration: number;  // minutes
    kind: 'solo' | 'group';
    type: 'StandardEventType' | 'AdhocEventType';
    color: string;
    description_plain?: string;
}

export interface CalendlyBusyTime {
    type: 'calendly' | 'external';
    start_time: string;  // ISO
    end_time: string;    // ISO
    buffered_start_time?: string;
    buffered_end_time?: string;
}

export interface CalendlySchedulingLink {
    booking_url: string;
    owner: string;
    owner_type: string;
}

export interface CalendlyScheduledEvent {
    uri: string;
    name: string;
    status: 'active' | 'canceled';
    start_time: string;
    end_time: string;
    event_type: string;
    location?: {
        type: string;
        location?: string;
    };
    cancellation?: {
        canceled_by: string;
        reason?: string;
    };
}

// ============================================================================
// HTTP Helper
// ============================================================================

async function calendlyFetch<T>(
    config: CalendlyConfig,
    path: string,
    options: RequestInit = {},
): Promise<{ data: T | null; error?: string }> {
    try {
        const response = await fetch(`${CALENDLY_API_BASE}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${config.apiToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
            signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const message = (body as { message?: string }).message || `HTTP ${response.status}`;
            return { data: null, error: `Calendly API error: ${message}` };
        }

        const json = await response.json();
        return { data: json as T };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { data: null, error: `Calendly request failed: ${message}` };
    }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get current user info — validates token and returns user URI
 */
export async function getCurrentUser(
    config: CalendlyConfig,
): Promise<{ data: CalendlyUser | null; error?: string }> {
    const result = await calendlyFetch<{ resource: CalendlyUser }>(config, '/users/me');
    if (result.error || !result.data) {
        return { data: null, error: result.error };
    }
    return { data: result.data.resource };
}

/**
 * List event types for a user
 */
export async function getEventTypes(
    config: CalendlyConfig,
    userUri: string,
): Promise<{ data: CalendlyEventType[]; error?: string }> {
    const params = new URLSearchParams({
        user: userUri,
        active: 'true',
        count: '100',
    });

    const result = await calendlyFetch<{ collection: CalendlyEventType[] }>(
        config,
        `/event_types?${params.toString()}`,
    );

    if (result.error || !result.data) {
        return { data: [], error: result.error };
    }
    return { data: result.data.collection };
}

/**
 * Get user busy times for a date range
 */
export async function getUserBusyTimes(
    config: CalendlyConfig,
    userUri: string,
    startTime: string,  // ISO datetime
    endTime: string,    // ISO datetime
): Promise<{ data: CalendlyBusyTime[]; error?: string }> {
    const params = new URLSearchParams({
        user: userUri,
        start_time: startTime,
        end_time: endTime,
    });

    const result = await calendlyFetch<{ collection: CalendlyBusyTime[] }>(
        config,
        `/user_busy_times?${params.toString()}`,
    );

    if (result.error || !result.data) {
        return { data: [], error: result.error };
    }
    return { data: result.data.collection };
}

/**
 * Create a one-time scheduling link for an event type
 */
export async function createSchedulingLink(
    config: CalendlyConfig,
    eventTypeUri: string,
    maxEventCount: number = 1,
): Promise<{ data: CalendlySchedulingLink | null; error?: string }> {
    const result = await calendlyFetch<{ resource: CalendlySchedulingLink }>(
        config,
        '/scheduling_links',
        {
            method: 'POST',
            body: JSON.stringify({
                owner: eventTypeUri,
                owner_type: 'EventType',
                max_event_count: maxEventCount,
            }),
        },
    );

    if (result.error || !result.data) {
        return { data: null, error: result.error };
    }
    return { data: result.data.resource };
}

/**
 * Cancel a scheduled event
 */
export async function cancelEvent(
    config: CalendlyConfig,
    eventUuid: string,
    reason?: string,
): Promise<{ success: boolean; error?: string }> {
    // Extract UUID from full URI if needed
    const uuid = eventUuid.includes('/') ? eventUuid.split('/').pop()! : eventUuid;

    const result = await calendlyFetch<unknown>(
        config,
        `/scheduled_events/${uuid}/cancellation`,
        {
            method: 'POST',
            body: JSON.stringify({
                ...(reason && { reason }),
            }),
        },
    );

    if (result.error) {
        return { success: false, error: result.error };
    }
    return { success: true };
}

/**
 * Get a specific scheduled event
 */
export async function getScheduledEvent(
    config: CalendlyConfig,
    eventUuid: string,
): Promise<{ data: CalendlyScheduledEvent | null; error?: string }> {
    const uuid = eventUuid.includes('/') ? eventUuid.split('/').pop()! : eventUuid;

    const result = await calendlyFetch<{ resource: CalendlyScheduledEvent }>(
        config,
        `/scheduled_events/${uuid}`,
    );

    if (result.error || !result.data) {
        return { data: null, error: result.error };
    }
    return { data: result.data.resource };
}

/**
 * List scheduled events for a user (upcoming)
 */
export async function getScheduledEvents(
    config: CalendlyConfig,
    userUri: string,
    minStartTime?: string,
    maxStartTime?: string,
): Promise<{ data: CalendlyScheduledEvent[]; error?: string }> {
    const params = new URLSearchParams({
        user: userUri,
        status: 'active',
        count: '20',
        sort: 'start_time:asc',
    });
    if (minStartTime) params.set('min_start_time', minStartTime);
    if (maxStartTime) params.set('max_start_time', maxStartTime);

    const result = await calendlyFetch<{ collection: CalendlyScheduledEvent[] }>(
        config,
        `/scheduled_events?${params.toString()}`,
    );

    if (result.error || !result.data) {
        return { data: [], error: result.error };
    }
    return { data: result.data.collection };
}
