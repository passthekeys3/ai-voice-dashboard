import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { verifyOAuthState, storeOAuthTokens, extractRedirectBase } from '@/lib/auth/oauth-helpers';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`;
const OAUTH_TOKEN_TIMEOUT = 15_000;

/**
 * GET /api/auth/slack/callback - Slack OAuth callback
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
            console.error('Slack OAuth error:', error);
            const base = extractRedirectBase(state);
            return NextResponse.redirect(
                new URL(`${base}?slack=error&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?slack=error&message=Missing+code+or+state', request.url)
            );
        }

        if (!SLACK_CLIENT_SECRET) {
            return NextResponse.redirect(
                new URL('/settings?slack=error&message=Server+configuration+error', request.url)
            );
        }

        const stateData = verifyOAuthState(state, SLACK_CLIENT_SECRET);
        if (!stateData) {
            return NextResponse.redirect(
                new URL('/settings?slack=error&message=Invalid+state+parameter', request.url)
            );
        }

        const { agencyId, clientId, timestamp } = stateData;
        const redirectBase = clientId ? `/clients/${clientId}` : '/settings';

        if (Date.now() - timestamp > 5 * 60 * 1000) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=OAuth+session+expired`, request.url)
            );
        }

        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=Session+expired+or+unauthorized`, request.url)
            );
        }
        if (user.agency.id !== agencyId) {
            console.error(`Slack OAuth: session agency ${user.agency.id} does not match state agency ${agencyId}`);
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=Agency+mismatch`, request.url)
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
                new URL(`${redirectBase}?slack=error&message=Agency+not+found`, request.url)
            );
        }

        const tierError = checkFeatureAccess(agency.subscription_price_id, agency.subscription_status, 'crm_integrations', agency.beta_ends_at);
        if (tierError) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=Integrations+require+a+Growth+plan+or+higher`, request.url)
            );
        }

        if (!SLACK_CLIENT_ID) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=Server+configuration+error`, request.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: SLACK_CLIENT_ID,
                client_secret: SLACK_CLIENT_SECRET,
                code,
                redirect_uri: SLACK_REDIRECT_URI,
            }),
            signal: AbortSignal.timeout(OAUTH_TOKEN_TIMEOUT),
        });

        if (!tokenResponse.ok) {
            console.error('Slack token exchange HTTP error:', tokenResponse.status);
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=Failed+to+exchange+code`, request.url)
            );
        }

        const tokens = await tokenResponse.json();

        // Slack returns { ok: true/false } in the body
        if (!tokens.ok) {
            console.error('Slack token exchange error:', tokens.error);
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=${encodeURIComponent(tokens.error || 'Token exchange failed')}`, request.url)
            );
        }

        // Store tokens
        const storeError = await storeOAuthTokens(supabase, 'slack', agencyId, clientId, {
            access_token: tokens.access_token,
            webhook_url: tokens.incoming_webhook?.url || null,
            channel_id: tokens.incoming_webhook?.channel_id || null,
            channel_name: tokens.incoming_webhook?.channel || null,
            team_name: tokens.team?.name || null,
            enabled: true,
        });

        if (storeError) {
            console.error('Failed to store Slack tokens:', storeError);
            return NextResponse.redirect(
                new URL(`${redirectBase}?slack=error&message=Failed+to+save+tokens`, request.url)
            );
        }

        return NextResponse.redirect(
            new URL(`${redirectBase}?slack=connected`, request.url)
        );
    } catch (error) {
        console.error('Slack OAuth callback error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.redirect(
            new URL('/settings?slack=error&message=Internal+error', request.url)
        );
    }
}
