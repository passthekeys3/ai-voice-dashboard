/**
 * HubSpot OAuth token management.
 *
 * HubSpot refresh tokens are single-use — each refresh returns a new pair.
 * A singleton promise prevents concurrent refresh attempts from consuming
 * the same single-use token twice.
 */

import { HUBSPOT_API_TIMEOUT } from './shared';

/** Result of a successful token refresh. */
interface TokenRefreshResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

// Singleton lock — prevents concurrent refresh races
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange a refresh token for a new access + refresh token pair.
 * Uses the HubSpot OAuth v3 token endpoint (not the CRM API base).
 */
export async function refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
): Promise<TokenRefreshResult | null> {
    try {
        const response = await fetch('https://api.hubapi.com/oauth/v3/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
            }),
            signal: AbortSignal.timeout(HUBSPOT_API_TIMEOUT),
        });

        if (!response.ok) {
            console.error('HubSpot refresh token error:', response.status);
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
        };
    } catch (error) {
        console.error('HubSpot refreshAccessToken error:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

/**
 * Return a valid access token, refreshing if expired.
 *
 * Token validity is checked with a 5-minute buffer so we refresh
 * before the token actually expires. The singleton promise ensures
 * only one refresh runs at a time — critical because HubSpot refresh
 * tokens are single-use.
 */
export async function getValidAccessToken(
    config: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
    },
    updateTokens?: (newTokens: { accessToken: string; refreshToken: string; expiresAt: number }) => Promise<void>,
): Promise<string | null> {
    if (!config.access_token) return null;

    // 5-minute buffer before expiry
    const bufferMs = 5 * 60 * 1000;
    if (config.expires_at && Date.now() + bufferMs < config.expires_at) {
        return config.access_token;
    }

    // Token expired — need refresh
    if (!config.refresh_token) return null;

    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('HubSpot client credentials not configured for token refresh');
        return null;
    }

    // Singleton: if a refresh is already in-flight, wait for it
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
        try {
            const refreshed = await refreshAccessToken(clientId, clientSecret, config.refresh_token!);
            if (!refreshed) return null;

            // Persist the new token pair (caller stores in DB)
            if (updateTokens) {
                await updateTokens({
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    expiresAt: Date.now() + refreshed.expiresIn * 1000,
                });
            }

            return refreshed.accessToken;
        } catch (error) {
            console.error('HubSpot token refresh error:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        } finally {
            _refreshPromise = null;
        }
    })();

    return _refreshPromise;
}
