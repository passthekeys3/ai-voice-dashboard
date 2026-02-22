import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import crypto from 'crypto';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_REDIRECT_URI = process.env.GHL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/ghl/callback`;

/**
 * GET /api/auth/ghl - Initiate GHL OAuth flow or disconnect
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

            // Clear OAuth tokens but preserve API key, trigger_config, calling_window
            const updatedIntegrations = {
                ...agency?.integrations,
                ghl: {
                    ...agency?.integrations?.ghl,
                    access_token: null,
                    refresh_token: null,
                    expires_at: null,
                    oauth_location_id: null,
                    auth_method: agency?.integrations?.ghl?.api_key ? 'api_key' as const : null,
                    enabled: !!agency?.integrations?.ghl?.api_key,
                },
            };

            await supabase
                .from('agencies')
                .update({
                    integrations: updatedIntegrations,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.agency.id);

            return NextResponse.redirect(new URL('/settings?ghl=disconnected', request.url));
        }

        // Check if GHL OAuth is configured
        if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
            return NextResponse.json(
                { error: 'GHL OAuth not configured. Please set GHL_CLIENT_ID and GHL_CLIENT_SECRET environment variables.' },
                { status: 500 }
            );
        }

        // Generate state parameter for CSRF protection with HMAC signature
        const statePayload = JSON.stringify({
            agencyId: user.agency.id,
            timestamp: Date.now(),
        });
        const stateSignature = crypto
            .createHmac('sha256', GHL_CLIENT_SECRET)
            .update(statePayload)
            .digest('hex');
        const state = Buffer.from(`${statePayload}.${stateSignature}`).toString('base64');

        // Build GHL OAuth URL (Location-level access)
        const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', GHL_REDIRECT_URI);
        authUrl.searchParams.set('client_id', GHL_CLIENT_ID);
        authUrl.searchParams.set('state', state);

        return NextResponse.redirect(authUrl.toString());
    } catch (error) {
        console.error('GHL OAuth initiation error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
