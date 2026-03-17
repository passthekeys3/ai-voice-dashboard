import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import crypto from 'crypto';

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

        // Handle OAuth errors
        if (error) {
            console.error('HubSpot OAuth error:', error);
            return NextResponse.redirect(
                new URL(`/settings?hubspot=error&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Missing+code+or+state', request.url)
            );
        }

        // Verify state HMAC signature and extract agency ID + optional client ID
        let agencyId: string;
        let clientId: string | undefined;
        let stateTimestamp: number;
        try {
            const decoded = Buffer.from(state, 'base64').toString();
            const lastDotIndex = decoded.lastIndexOf('.');
            if (lastDotIndex === -1) {
                throw new Error('Missing signature');
            }

            const statePayload = decoded.slice(0, lastDotIndex);
            const stateSignature = decoded.slice(lastDotIndex + 1);

            // Verify HMAC signature
            if (!HUBSPOT_CLIENT_SECRET) {
                throw new Error('HubSpot client secret not configured');
            }
            const expectedSignature = crypto
                .createHmac('sha256', HUBSPOT_CLIENT_SECRET)
                .update(statePayload)
                .digest('hex');

            if (!crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSignature))) {
                throw new Error('Invalid signature');
            }

            const stateData = JSON.parse(statePayload);
            agencyId = stateData.agencyId;
            clientId = stateData.clientId; // undefined for agency-level OAuth
            stateTimestamp = stateData.timestamp;
        } catch {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Invalid+state+parameter', request.url)
            );
        }

        const redirectBase = clientId ? `/clients/${clientId}` : '/settings';

        // Check timestamp (5 minute expiry) — after redirectBase so redirect goes to the correct page
        if (Date.now() - stateTimestamp > 5 * 60 * 1000) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=OAuth+session+expired`, request.url)
            );
        }

        // Defense-in-depth: verify the current session matches the agencyId in the state
        // The HMAC signature prevents state tampering, but this ensures the same user
        // who initiated the flow is completing it.
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

        // Defense-in-depth: re-verify tier in case agency downgraded during OAuth flow
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'crm_integrations', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=CRM+integrations+require+a+Growth+plan+or+higher`, request.url)
            );
        }

        // Validate env vars before token exchange
        if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
            console.error('HubSpot OAuth callback: missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET');
            return NextResponse.redirect(
                new URL(`${redirectBase}?hubspot=error&message=Server+configuration+error`, request.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://api.hubapi.com/oauth/v3/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
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

        // Store tokens in database
        const supabase = await createAdminClient();

        // Safely parse expires_in (default to 6h if missing/invalid — HubSpot tokens typically last 6h)
        const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 21600;

        const hubspotTokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (expiresIn * 1000),
            enabled: true,
        };

        if (clientId) {
            // Per-client OAuth — store in clients.integrations
            const { data: client } = await supabase
                .from('clients')
                .select('integrations')
                .eq('id', clientId)
                .eq('agency_id', agencyId)
                .single();

            if (!client) {
                console.error('HubSpot OAuth callback: client not found:', clientId);
                return NextResponse.redirect(
                    new URL(`${redirectBase}?hubspot=error&message=Client+not+found`, request.url)
                );
            }

            const clientIntegrations = (client.integrations as Record<string, unknown>) || {};
            const updatedIntegrations = {
                ...clientIntegrations,
                hubspot: {
                    ...(clientIntegrations.hubspot as Record<string, unknown> || {}),
                    ...hubspotTokenData,
                },
            };

            const { error: updateError } = await supabase
                .from('clients')
                .update({
                    integrations: updatedIntegrations,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', clientId)
                .eq('agency_id', agencyId);

            if (updateError) {
                console.error('Failed to store HubSpot tokens on client:', updateError.code);
                return NextResponse.redirect(
                    new URL(`${redirectBase}?hubspot=error&message=Failed+to+save+tokens`, request.url)
                );
            }
        } else {
            // Agency-level OAuth — store in agencies.integrations
            const { data: agency } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', agencyId)
                .single();

            const updatedIntegrations = {
                ...agency?.integrations,
                hubspot: {
                    ...agency?.integrations?.hubspot,
                    ...hubspotTokenData,
                },
            };

            const { error: updateError } = await supabase
                .from('agencies')
                .update({
                    integrations: updatedIntegrations,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', agencyId);

            if (updateError) {
                console.error('Failed to store HubSpot tokens:', updateError.code);
                return NextResponse.redirect(
                    new URL(`${redirectBase}?hubspot=error&message=Failed+to+save+tokens`, request.url)
                );
            }
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
