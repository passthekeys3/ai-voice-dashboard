import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`;

/**
 * GET /api/auth/google-calendar/callback - Google Calendar OAuth callback
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
            console.error('Google Calendar OAuth error:', error);
            return NextResponse.redirect(
                new URL(`/settings?google_calendar=error&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?google_calendar=error&message=Missing+code+or+state', request.url)
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
            if (!GOOGLE_CLIENT_SECRET) {
                throw new Error('Google client secret not configured');
            }
            const expectedSignature = crypto
                .createHmac('sha256', GOOGLE_CLIENT_SECRET)
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
                    new URL('/settings?google_calendar=error&message=OAuth+session+expired', request.url)
                );
            }
        } catch {
            return NextResponse.redirect(
                new URL('/settings?google_calendar=error&message=Invalid+state+parameter', request.url)
            );
        }

        // Validate env vars before token exchange
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            console.error('Google Calendar OAuth callback: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
            return NextResponse.redirect(
                new URL('/settings?google_calendar=error&message=Server+configuration+error', request.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                code,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Google Calendar token exchange error:', errorText);
            return NextResponse.redirect(
                new URL('/settings?google_calendar=error&message=Failed+to+exchange+code', request.url)
            );
        }

        const tokens = await tokenResponse.json();

        // Validate required tokens are present
        // Google only returns refresh_token on first auth (with prompt=consent)
        if (!tokens.access_token || !tokens.refresh_token) {
            console.error('Google Calendar token exchange returned incomplete tokens');
            return NextResponse.redirect(
                new URL('/settings?google_calendar=error&message=Incomplete+token+response', request.url)
            );
        }

        // Store tokens in database
        const supabase = await createAdminClient();

        const { data: agency } = await supabase
            .from('agencies')
            .select('integrations')
            .eq('id', agencyId)
            .single();

        const updatedIntegrations = {
            ...agency?.integrations,
            google_calendar: {
                ...agency?.integrations?.google_calendar,
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
            console.error('Failed to store Google Calendar tokens:', updateError);
            return NextResponse.redirect(
                new URL('/settings?google_calendar=error&message=Failed+to+save+tokens', request.url)
            );
        }

        return NextResponse.redirect(
            new URL('/settings?google_calendar=connected', request.url)
        );
    } catch (error) {
        console.error('Google Calendar OAuth callback error:', error);
        return NextResponse.redirect(
            new URL('/settings?google_calendar=error&message=Internal+error', request.url)
        );
    }
}
