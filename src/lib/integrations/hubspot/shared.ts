/**
 * HubSpot shared constants, types, and fetch helper.
 * All HubSpot submodules import from here to avoid duplication.
 */

export const HUBSPOT_API_BASE = 'https://api.hubspot.com';
export const HUBSPOT_API_TIMEOUT = 15_000;

// ── Types ────────────────────────────────────────────────

/** Minimal config — just an access token (OAuth or API key). */
export interface HubSpotConfig {
    accessToken: string;
}

/** Contact returned by HubSpot CRM v3 contacts API. */
export interface HubSpotContact {
    id: string;
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        hs_lead_status?: string;
        /** Custom semicolon-separated tag property (not a native HubSpot field). */
        ai_call_tags?: string;
        [key: string]: string | undefined;
    };
}

/** Deal object from CRM v3 deals API. */
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

/** Meeting engagement from CRM v3 meetings API. */
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

/** Deal pipeline with stages. */
export interface HubSpotPipeline {
    id: string;
    label: string;
    stages: { id: string; label: string }[];
}

// ── Fetch Helper ─────────────────────────────────────────

/**
 * Make an authenticated HubSpot API request.
 * Centralizes auth headers, timeout, and error logging so callers
 * don't repeat the same boilerplate 20+ times.
 */
export async function hubspotFetch<T>(
    config: HubSpotConfig,
    path: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: Record<string, unknown>;
        /** Raw query string appended to the URL (already encoded). */
        query?: string;
    } = {},
): Promise<T | null> {
    const { method = 'GET', body, query } = options;

    try {
        const url = query
            ? `${HUBSPOT_API_BASE}${path}?${query}`
            : `${HUBSPOT_API_BASE}${path}`;

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(HUBSPOT_API_TIMEOUT),
        });

        if (!response.ok) {
            console.error(`HubSpot ${method} ${path} error:`, response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`HubSpot ${method} ${path} error:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}
