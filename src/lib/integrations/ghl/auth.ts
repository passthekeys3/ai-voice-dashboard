/**
 * GHL OAuth token management.
 * Handles token refresh with singleton promise to prevent race conditions.
 */

import { GHL_API_BASE, GHL_API_TIMEOUT } from './shared';

let _refreshPromise: Promise<string | null> | null = null;

/** Refresh a GHL OAuth access token (single-use refresh tokens). */
async function refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
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
            signal: AbortSignal.timeout(GHL_API_TIMEOUT),
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
 * Uses a singleton promise to prevent concurrent refresh races
 * (GHL refresh tokens are single-use).
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

    // Check if token is still valid (with 5-minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (config.expires_at && Date.now() + bufferMs < config.expires_at) {
        return config.access_token;
    }

    if (!config.refresh_token) return null;

    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.warn('GHL client credentials not configured for token refresh');
        return null;
    }

    // Singleton promise prevents concurrent refresh token consumption
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
        try {
            const refreshed = await refreshAccessToken(clientId, clientSecret, config.refresh_token!);
            if (!refreshed) return null;

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
