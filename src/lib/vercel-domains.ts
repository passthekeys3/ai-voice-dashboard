/**
 * Vercel Domains API Client
 * Programmatically add, remove, and check custom domains on the Vercel project.
 *
 * Required env vars:
 *   VERCEL_TOKEN       – Vercel API token (Settings → Tokens)
 *   VERCEL_PROJECT_ID  – The project ID (Settings → General → Project ID)
 *   VERCEL_TEAM_ID     – (optional) Team/org ID if the project belongs to a team
 */

const VERCEL_API = 'https://api.vercel.com';

function getConfig() {
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID; // optional

    if (!token || !projectId) {
        return null;
    }

    return { token, projectId, teamId };
}

function buildUrl(path: string, teamId?: string): string {
    const url = new URL(path, VERCEL_API);
    if (teamId) {
        url.searchParams.set('teamId', teamId);
    }
    return url.toString();
}

interface VercelDomain {
    name: string;
    verified: boolean;
    configured?: boolean;
    gitBranch?: string | null;
    verification?: { type: string; domain: string; value: string; reason: string }[];
}

interface VercelError {
    code: string;
    message: string;
}

interface VercelResponse {
    error?: VercelError;
}

/**
 * Check whether the Vercel Domains API is configured.
 * Returns false when VERCEL_TOKEN or VERCEL_PROJECT_ID is missing — callers
 * should treat domain operations as no-ops rather than hard errors.
 */
export function isVercelConfigured(): boolean {
    return getConfig() !== null;
}

/**
 * Add a domain to the Vercel project.
 * Returns the domain object on success, or an error string on failure.
 */
export async function addDomainToVercel(
    domain: string
): Promise<{ success: true; domain: VercelDomain } | { success: false; error: string }> {
    const config = getConfig();
    if (!config) {
        return { success: false, error: 'Vercel API not configured (missing VERCEL_TOKEN or VERCEL_PROJECT_ID)' };
    }

    try {
        const url = buildUrl(`/v10/projects/${config.projectId}/domains`, config.teamId);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: domain.toLowerCase() }),
        });

        const data = await res.json() as VercelDomain & VercelResponse;

        if (!res.ok) {
            // Domain already exists on this project — treat as success
            if (data.error?.code === 'domain_already_exists') {
                return { success: true, domain: { name: domain.toLowerCase(), verified: true } };
            }
            return { success: false, error: data.error?.message || `Vercel API error (${res.status})` };
        }

        return { success: true, domain: data };
    } catch (err) {
        console.error('[vercel-domains] addDomain error:', err);
        return { success: false, error: 'Failed to communicate with Vercel API' };
    }
}

/**
 * Remove a domain from the Vercel project.
 */
export async function removeDomainFromVercel(
    domain: string
): Promise<{ success: true } | { success: false; error: string }> {
    const config = getConfig();
    if (!config) {
        return { success: false, error: 'Vercel API not configured' };
    }

    try {
        const url = buildUrl(
            `/v9/projects/${config.projectId}/domains/${domain.toLowerCase()}`,
            config.teamId
        );
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${config.token}`,
            },
        });

        if (!res.ok) {
            const data = await res.json() as VercelResponse;
            // Domain not found on project — treat as success (already removed)
            if (res.status === 404) {
                return { success: true };
            }
            return { success: false, error: data.error?.message || `Vercel API error (${res.status})` };
        }

        return { success: true };
    } catch (err) {
        console.error('[vercel-domains] removeDomain error:', err);
        return { success: false, error: 'Failed to communicate with Vercel API' };
    }
}

/**
 * Get domain configuration from Vercel (check if it exists and its status).
 */
export async function getDomainFromVercel(
    domain: string
): Promise<{ success: true; domain: VercelDomain } | { success: false; error: string }> {
    const config = getConfig();
    if (!config) {
        return { success: false, error: 'Vercel API not configured' };
    }

    try {
        const url = buildUrl(
            `/v9/projects/${config.projectId}/domains/${domain.toLowerCase()}`,
            config.teamId
        );
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${config.token}`,
            },
        });

        if (!res.ok) {
            const data = await res.json() as VercelResponse;
            return { success: false, error: data.error?.message || `Vercel API error (${res.status})` };
        }

        const data = await res.json() as VercelDomain;
        return { success: true, domain: data };
    } catch (err) {
        console.error('[vercel-domains] getDomain error:', err);
        return { success: false, error: 'Failed to communicate with Vercel API' };
    }
}

/**
 * Verify a domain on Vercel (triggers Vercel's own verification check).
 */
export async function verifyDomainOnVercel(
    domain: string
): Promise<{ success: true; domain: VercelDomain } | { success: false; error: string }> {
    const config = getConfig();
    if (!config) {
        return { success: false, error: 'Vercel API not configured' };
    }

    try {
        const url = buildUrl(
            `/v9/projects/${config.projectId}/domains/${domain.toLowerCase()}/verify`,
            config.teamId
        );
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.token}`,
            },
        });

        if (!res.ok) {
            const data = await res.json() as VercelResponse;
            return { success: false, error: data.error?.message || `Vercel API error (${res.status})` };
        }

        const data = await res.json() as VercelDomain;
        return { success: true, domain: data };
    } catch (err) {
        console.error('[vercel-domains] verifyDomain error:', err);
        return { success: false, error: 'Failed to communicate with Vercel API' };
    }
}
