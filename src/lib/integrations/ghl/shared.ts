/**
 * GHL shared constants, types, and fetch helper.
 * All GHL submodules import from here to avoid duplication.
 */

export const GHL_API_BASE = 'https://services.leadconnectorhq.com';
export const GHL_API_TIMEOUT = 15_000;

/** Standard GHL API headers */
const GHL_HEADERS = {
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
} as const;

/** Calendar endpoints use an older API version */
const GHL_CALENDAR_HEADERS = {
    'Content-Type': 'application/json',
    'Version': '2021-04-15',
} as const;

// ── Types ────────────────────────────────────────────────

export interface GHLConfig {
    apiKey: string;
    locationId: string;
}

export interface GHLContact {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
}

// ── Fetch Helper ─────────────────────────────────────────

/**
 * Make an authenticated GHL API request.
 * Reduces boilerplate — every GHL function was repeating the same
 * headers, timeout, and error handling pattern.
 */
export async function ghlFetch<T>(
    config: GHLConfig,
    path: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: Record<string, unknown>;
        params?: Record<string, string>;
        calendar?: boolean; // Use calendar API version
    } = {},
): Promise<T | null> {
    const { method = 'GET', body, params, calendar } = options;

    try {
        let url = `${GHL_API_BASE}${path}`;
        if (params) {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams.toString()}`;
        }

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                ...(calendar ? GHL_CALENDAR_HEADERS : GHL_HEADERS),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(GHL_API_TIMEOUT),
        });

        if (!response.ok) {
            console.error(`GHL ${method} ${path} error:`, response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`GHL ${method} ${path} error:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}
