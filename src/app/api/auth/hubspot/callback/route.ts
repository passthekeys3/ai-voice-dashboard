import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { verifyOAuthState, storeOAuthTokens, extractRedirectBase } from '@/lib/auth/oauth-helpers';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`;
const OAUTH_TOKEN_TIMEOUT = 15_000;

/**
 * GET /api/auth/hubspot/callback - HubSpot OAuth callback
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors (use state to determine redirect target if available)
        if (error) {
            console.error('HubSpot OAuth error:', error);
            const base = extractRedirectBase(state);
            return NextResponse.redirect(
                new URL(`${base}?hubspot=error&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Missing+code+or+state', request.url)
            );
        }

        // Verify state HMAC signature and extract agency ID + optional client ID
        if (!HUBSPOT_CLIENT_SECRET) {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Server+configuration+error', request.url)
            );
        }

        const stateData = verifyOAuthState(state, HUBSPOT_CLIENT_SECRET);
        if (!stateData) {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Invalid+state+parameter', request.url)
            );
        }

        const { agencyId, clientId, timestamp } = stateData;
        const redirectBase = clientId ? `/clients/${clientId}` : '/settings';

        // Check timestamp (5 minute expiry)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=OAuth+session+expired`, request.url)
            );
        }

        // Defense-in-depth: verify the current session matches the agencyId in the state
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Session+expired+or+unauthorized`, request.url)
            );
        }
        if (user.agency.id !== agencyId) {
            console.error(`HubSpot OAuth: session agency ${user.agency.id} does not match state agency ${agencyId}`);
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Agency+mismatch`, request.url)
            );
        }

        // Defense-in-depth: re-verify tier from fresh DB data in case agency downgraded during OAuth flow
        const supabase = await createAdminClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('subscription_price_id, subscription_status, beta_ends_at')
            .eq('id', agencyId)
            .single();

        if (!agency) {
            console.error('HubSpot OAuth callback: agency not found:', agencyId);
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Agency+not+found`, request.url)
            );
        }

        const tierError = checkFeatureAccess(agency.subscription_price_id, agency.subscription_status, 'crm_integrations', agency.beta_ends_at);
        if (tierError) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=CRM+integrations+require+a+Growth+plan+or+higher`, request.url)
            );
        }

        // Validate env vars before token exchange
        if (!HUBSPOT_CLIENT_ID) {
            console.error('HubSpot OAuth callback: missing HUBSPOT_CLIENT_ID');
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Server+configuration+error`, request.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://api.hubapi.com/oauth/v3/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: HUBSPOT_CLIENT_ID,
                client_secret: HUBSPOT_CLIENT_SECRET,
                redirect_uri: HUBSPOT_REDIRECT_URI,
                code,
            }),
            signal: AbortSignal.timeout(OAUTH_TOKEN_TIMEOUT),
        });

        if (!tokenResponse.ok) {
            console.error('HubSpot token exchange error:', tokenResponse.status);
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Failed+to+exchange+code`, request.url)
            );
        }

        const tokens = await tokenResponse.json();

        // Validate required tokens are present
        if (!tokens.access_token || !tokens.refresh_token) {
            console.error('HubSpot token exchange returned incomplete tokens');
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Incomplete+token+response`, request.url)
            );
        }

        // Safely parse expires_in (default to 6h if missing/invalid — HubSpot tokens typically last 6h)
        const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 21600;

        // Store tokens via shared helper (routes to client or agency table)
        const storeError = await storeOAuthTokens(supabase, 'hubspot', agencyId, clientId, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (expiresIn * 1000),
            enabled: true,
        });

        if (storeError) {
            console.error('Failed to store HubSpot tokens:', storeError);
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Failed+to+save+tokens`, request.url)
            );
        }

        return NextResponse.redirect(
            new URL(`${redirectBase}?hubspot=connected`, request.url)
        );
    } catch (error) {
        console.error('HubSpot OAuth callback error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.redirect(
            new URL('/settings?hubspot=error&message=Internal+error', request.url)
        );
    }
}
