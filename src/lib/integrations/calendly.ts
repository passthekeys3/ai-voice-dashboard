/**
 * Calendly Integration — REST API v2
 *
 * Supports OAuth access_token (preferred) and Personal Access Token (legacy).
 * API docs: https://developer.calendly.com/api-docs
 */

const CALENDLY_API_BASE = 'https://api.calendly.com';

// ============================================================================
// Types
// ============================================================================

export interface CalendlyConfig {
    apiToken: string;           // OAuth access_token or legacy Personal Access Token
    userUri?: string;
    defaultEventTypeUri?: string;
}

/**
 * Build a CalendlyConfig from an integration config object.
 * Prefers OAuth access_token over legacy api_token.
 */
export function buildCalendlyConfig(
    config: { access_token?: string; api_token?: string; user_uri?: string; default_event_type_uri?: string },
): CalendlyConfig | null {
    const token = config.access_token || config.api_token;
    if (!token) return null;
    return {
        apiToken: token,
        userUri: config.user_uri,
        defaultEventTypeUri: config.default_event_type_uri,
    };
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

// ============================================================================
// Token Refresh (OAuth)
// ============================================================================

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;

// Singleton promise to prevent concurrent refresh races
let refreshPromise: Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> | null = null;

/**
 * Get a valid Calendly access token, refreshing if expired.
 * Uses singleton promise pattern to prevent concurrent refresh races.
 * Returns null if no OAuth tokens available (falls back to api_token).
 */
export async function getValidCalendlyToken(
    config: { access_token?: string; refresh_token?: string; expires_at?: number; api_token?: string },
    updateTokens?: (newTokens: { accessToken: string; refreshToken?: string; expiresAt?: number }) => Promise<void>,
): Promise<string | null> {
    // If no OAuth tokens, fall back to legacy api_token
    if (!config.access_token) {
        return config.api_token || null;
    }

    // Check if token is still valid (5-minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (config.expires_at && Date.now() < config.expires_at - bufferMs) {
        return config.access_token;
    }

    // Need to refresh
    if (!config.refresh_token || !CALENDLY_CLIENT_ID || !CALENDLY_CLIENT_SECRET) {
        return config.access_token; // Return potentially expired token as last resort
    }

    // Singleton promise to prevent concurrent refreshes
    if (!refreshPromise) {
        refreshPromise = (async () => {
            try {
                const response = await fetch('https://auth.calendly.com/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        client_id: CALENDLY_CLIENT_ID!,
                        client_secret: CALENDLY_CLIENT_SECRET!,
                        refresh_token: config.refresh_token!,
                    }),
                    signal: AbortSignal.timeout(15000),
                });

                if (!response.ok) {
                    console.error('Calendly token refresh failed:', response.status);
                    return null;
                }

                const tokens = await response.json();
                const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 7200;
                const result = {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    expiresAt: Date.now() + (expiresIn * 1000),
                };

                // Persist new tokens
                if (updateTokens) {
                    await updateTokens(result);
                }

                return result;
            } catch (err) {
                console.error('Calendly token refresh error:', err instanceof Error ? err.message : 'Unknown error');
                return null;
            } finally {
                refreshPromise = null;
            }
        })();
    }

    const refreshed = await refreshPromise;
    return refreshed?.accessToken || config.access_token;
}
