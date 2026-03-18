import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { verifyOAuthState, storeOAuthTokens, extractRedirectBase } from '@/lib/auth/oauth-helpers';

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const CALENDLY_REDIRECT_URI = process.env.CALENDLY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/calendly/callback`;
const OAUTH_TOKEN_TIMEOUT = 15_000;

/**
 * GET /api/auth/calendly/callback - Calendly OAuth callback
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
            console.error('Calendly OAuth error:', error);
            const base = extractRedirectBase(state);
            return NextResponse.redirect(
                new URL(`${base}?calendly=error&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?calendly=error&message=Missing+code+or+state', request.url)
            );
        }

        if (!CALENDLY_CLIENT_SECRET) {
            return NextResponse.redirect(
                new URL('/settings?calendly=error&message=Server+configuration+error', request.url)
            );
        }

        const stateData = verifyOAuthState(state, CALENDLY_CLIENT_SECRET);
        if (!stateData) {
            return NextResponse.redirect(
                new URL('/settings?calendly=error&message=Invalid+state+parameter', request.url)
            );
        }

        const { agencyId, clientId, timestamp } = stateData;
        const redirectBase = clientId ? `/clients/${clientId}` : '/settings';

        if (Date.now() - timestamp > 5 * 60 * 1000) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=OAuth+session+expired`, request.url)
            );
        }

        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Session+expired+or+unauthorized`, request.url)
            );
        }
        if (user.agency.id !== agencyId) {
            console.error(`Calendly OAuth: session agency ${user.agency.id} does not match state agency ${agencyId}`);
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Agency+mismatch`, request.url)
            );
        }

        // Fresh DB tier check
        const supabase = await createAdminClient();
        const { data: agency } = await supabase
            .from('agencies')
            .select('subscription_price_id, subscription_status, beta_ends_at')
            .eq('id', agencyId)
            .single();

        if (!agency) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Agency+not+found`, request.url)
            );
        }

        const tierError = checkFeatureAccess(agency.subscription_price_id, agency.subscription_status, 'crm_integrations', agency.beta_ends_at);
        if (tierError) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Integrations+require+a+Growth+plan+or+higher`, request.url)
            );
        }

        if (!CALENDLY_CLIENT_ID) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Server+configuration+error`, request.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: CALENDLY_CLIENT_ID,
                client_secret: CALENDLY_CLIENT_SECRET,
                code,
                redirect_uri: CALENDLY_REDIRECT_URI,
            }),
            signal: AbortSignal.timeout(OAUTH_TOKEN_TIMEOUT),
        });

        if (!tokenResponse.ok) {
            console.error('Calendly token exchange error:', tokenResponse.status);
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Failed+to+exchange+code`, request.url)
            );
        }

        const tokens = await tokenResponse.json();

        if (!tokens.access_token || !tokens.refresh_token) {
            console.error('Calendly token exchange returned incomplete tokens');
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Incomplete+token+response`, request.url)
            );
        }

        // Fetch user info to get user_uri and organization_uri
        let userUri: string | null = null;
        let organizationUri: string | null = null;

        try {
            const meResponse = await fetch('https://api.calendly.com/users/me', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
                signal: AbortSignal.timeout(OAUTH_TOKEN_TIMEOUT),
            });

            if (meResponse.ok) {
                const meData = await meResponse.json();
                userUri = meData.resource?.uri || null;
                organizationUri = meData.resource?.current_organization || null;
            }
        } catch (meError) {
            // Non-fatal — we can still store the tokens without user info
            console.error('Failed to fetch Calendly user info:', meError instanceof Error ? meError.message : 'Unknown error');
        }

        const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 7200; // Calendly tokens last 2 hours

        // Store tokens
        const storeError = await storeOAuthTokens(supabase, 'calendly', agencyId, clientId, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (expiresIn * 1000),
            user_uri: userUri,
            organization_uri: organizationUri,
            enabled: true,
        });

        if (storeError) {
            console.error('Failed to store Calendly tokens:', storeError);
            return NextResponse.redirect(
                new URL(`${redirectBase}?calendly=error&message=Failed+to+save+tokens`, request.url)
            );
        }

        return NextResponse.redirect(
            new URL(`${redirectBase}?calendly=connected`, request.url)
        );
    } catch (error) {
        console.error('Calendly OAuth callback error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.redirect(
            new URL('/settings?calendly=error&message=Internal+error', request.url)
        );
    }
}
