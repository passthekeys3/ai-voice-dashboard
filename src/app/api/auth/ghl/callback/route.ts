import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_REDIRECT_URI = process.env.GHL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/ghl/callback`;

/**
 * GET /api/auth/ghl/callback - GHL OAuth callback
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
            console.error('GHL OAuth error:', error);
            return NextResponse.redirect(
                new URL(`/settings?ghl=error&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Missing+code+or+state', request.url)
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
            if (!GHL_CLIENT_SECRET) {
                throw new Error('GHL client secret not configured');
            }
            const expectedSignature = crypto
                .createHmac('sha256', GHL_CLIENT_SECRET)
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
                    new URL('/settings?ghl=error&message=OAuth+session+expired', request.url)
                );
            }
        } catch {
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Invalid+state+parameter', request.url)
            );
        }

        // Validate env vars before token exchange
        if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
            console.error('GHL OAuth callback: missing GHL_CLIENT_ID or GHL_CLIENT_SECRET');
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Server+configuration+error', request.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: GHL_CLIENT_ID,
                client_secret: GHL_CLIENT_SECRET,
                code,
                redirect_uri: GHL_REDIRECT_URI,
                user_type: 'Location',
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('GHL token exchange error:', errorText);
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Failed+to+exchange+code', request.url)
            );
        }

        const tokens = await tokenResponse.json();

        // Validate required tokens and fields are present
        if (!tokens.access_token || !tokens.refresh_token || !tokens.locationId) {
            console.error('GHL token exchange returned incomplete response:', {
                hasAccessToken: !!tokens.access_token,
                hasRefreshToken: !!tokens.refresh_token,
                hasLocationId: !!tokens.locationId,
            });
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Incomplete+token+response', request.url)
            );
        }

        // Safely parse expires_in (default to 24h if missing/invalid)
        const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 86400;

        // Store tokens in database (deep merge to preserve existing config)
        const supabase = await createAdminClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('integrations')
            .eq('id', agencyId)
            .single();

        if (!agency) {
            console.error('GHL OAuth callback: agency not found:', agencyId);
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Agency+not+found', request.url)
            );
        }

        const updatedIntegrations = {
            ...agency.integrations,
            ghl: {
                ...agency.integrations?.ghl,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: Date.now() + (expiresIn * 1000),
                oauth_location_id: tokens.locationId,
                location_id: tokens.locationId || agency.integrations?.ghl?.location_id,
                enabled: true,
                auth_method: 'oauth' as const,
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
            console.error('Failed to store GHL tokens:', updateError);
            return NextResponse.redirect(
                new URL('/settings?ghl=error&message=Failed+to+save+tokens', request.url)
            );
        }

        return NextResponse.redirect(
            new URL('/settings?ghl=connected', request.url)
        );
    } catch (error) {
        console.error('GHL OAuth callback error:', error);
        return NextResponse.redirect(
            new URL('/settings?ghl=error&message=Internal+error', request.url)
        );
    }
}
