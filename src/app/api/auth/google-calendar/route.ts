import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`;

const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

/**
 * GET /api/auth/google-calendar - Initiate Google Calendar OAuth flow
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // Handle disconnect
        if (action === 'disconnect') {
            const supabase = await createAdminClient();

            const { data: agency } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', user.agency.id)
                .single();

            const updatedIntegrations = {
                ...agency?.integrations,
                google_calendar: { enabled: false },
            };

            await supabase
                .from('agencies')
                .update({
                    integrations: updatedIntegrations,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.agency.id);

            return NextResponse.redirect(new URL('/settings?google_calendar=disconnected', request.url));
        }

        // Check if Google OAuth is configured
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return NextResponse.json(
                { error: 'Google Calendar OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' },
                { status: 500 }
            );
        }

        // Generate state parameter for CSRF protection with HMAC signature
        const statePayload = JSON.stringify({
            agencyId: user.agency.id,
            timestamp: Date.now(),
        });
        const stateSignature = crypto
            .createHmac('sha256', GOOGLE_CLIENT_SECRET)
            .update(statePayload)
            .digest('hex');
        const state = Buffer.from(`${statePayload}.${stateSignature}`).toString('base64');

        // Build Google OAuth URL
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
        authUrl.searchParams.set('scope', GOOGLE_SCOPES);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('access_type', 'offline');
        // prompt=consent ensures a refresh token is always returned
        // (Google only sends refresh_token on first authorization otherwise)
        authUrl.searchParams.set('prompt', 'consent');

        return NextResponse.redirect(authUrl.toString());
    } catch (error) {
        console.error('Google Calendar OAuth initiation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
