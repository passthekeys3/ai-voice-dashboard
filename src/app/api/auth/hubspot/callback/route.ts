import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import crypto from 'crypto';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`;

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

        // Verify state HMAC signature and extract agency ID
        let agencyId: string;
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

            // Check timestamp (5 minute expiry)
            if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
                return NextResponse.redirect(
                    new URL('/settings?hubspot=error&message=OAuth+session+expired', request.url)
                );
            }
        } catch {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Invalid+state+parameter', request.url)
            );
        }

        // Defense-in-depth: verify the current session matches the agencyId in the state
        // The HMAC signature prevents state tampering, but this ensures the same user
        // who initiated the flow is completing it.
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Session+expired+or+unauthorized', request.url)
            );
        }
        if (user.agency.id !== agencyId) {
            console.error(`HubSpot OAuth: session agency ${user.agency.id} does not match state agency ${agencyId}`);
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Agency+mismatch', request.url)
            );
        }

        // Validate env vars before token exchange
        if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
            console.error('HubSpot OAuth callback: missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET');
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Server+configuration+error', request.url)
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
        });

        if (!tokenResponse.ok) {
            console.error('HubSpot token exchange error:', tokenResponse.status);
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Failed+to+exchange+code', request.url)
            );
        }

        const tokens = await tokenResponse.json();

        // Validate required tokens are present
        if (!tokens.access_token || !tokens.refresh_token) {
            console.error('HubSpot token exchange returned incomplete tokens');
            return NextResponse.redirect(
                new URL('/settings?hubspot=error&message=Incomplete+token+response', request.url)
            );
        }

        // Store tokens in database
        const supabase = await createAdminClient();

        // Get current integrations
        const { data: agency } = await supabase
            .from('agencies')
            .select('integrations')
            .eq('id', agencyId)
            .single();

        // Update with HubSpot tokens
        const updatedIntegrations = {
            ...agency?.integrations,
            hubspot: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: Date.now() + (tokens.expires_in * 1000),
                enabled: true,
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
                new URL('/settings?hubspot=error&message=Failed+to+save+tokens', request.url)
            );
        }

        // Redirect back to settings with success message
        return NextResponse.redirect(
            new URL('/settings?hubspot=connected', request.url)
        );
    } catch (error) {
        console.error('HubSpot OAuth callback error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.redirect(
            new URL('/settings?hubspot=error&message=Internal+error', request.url)
        );
    }
}
