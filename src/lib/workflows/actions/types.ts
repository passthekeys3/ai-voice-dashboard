/**
 * Shared types for workflow action handlers
 */

export interface CallData {
    call_id: string;
    agent_id: string;
    agent_name?: string;
    status: string;
    direction: string;
    duration_seconds: number;
    cost_cents: number;
    from_number?: string;
    to_number?: string;
    transcript?: string;
    recording_url?: string;
    summary?: string;
    sentiment?: string;
    started_at?: string;
    ended_at?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown; // Index signature for dynamic field access
}

export interface ActionHandlerResult {
    success: boolean;
    error?: string;
}

export interface GhlConfig {
    apiKey: string;
    locationId: string;
}

export interface HubspotConfig {
    accessToken: string;
}

export interface GcalConfig {
    accessToken: string;
    calendarId: string;
}

export interface CalendlyConfig {
    apiToken: string;
    userUri: string;
    defaultEventTypeUri?: string;
}
