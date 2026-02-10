import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import crypto from 'crypto';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`;

// OAuth scopes required for the integration
const HUBSPOT_SCOPES = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
].join(' ');

/**
 * GET /api/auth/hubspot - Initiate HubSpot OAuth flow
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

            // Get current integrations
            const { data: agency } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', user.agency.id)
                .single();

            // Remove HubSpot integration
            const updatedIntegrations = {
                ...agency?.integrations,
                hubspot: { enabled: false },
            };

            await supabase
                .from('agencies')
                .update({
                    integrations: updatedIntegrations,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.agency.id);

            // Redirect back to settings
            return NextResponse.redirect(new URL('/settings?hubspot=disconnected', request.url));
        }

        // Check if HubSpot OAuth is configured
        if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
            return NextResponse.json(
                { error: 'HubSpot OAuth not configured. Please set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET environment variables.' },
                { status: 500 }
            );
        }

        // Generate state parameter for CSRF protection with HMAC signature
        const statePayload = JSON.stringify({
            agencyId: user.agency.id,
            timestamp: Date.now(),
        });
        const stateSecret = HUBSPOT_CLIENT_SECRET!;
        const stateSignature = crypto
            .createHmac('sha256', stateSecret)
            .update(statePayload)
            .digest('hex');
        const state = Buffer.from(`${statePayload}.${stateSignature}`).toString('base64');

        // Build HubSpot OAuth URL
        const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
        authUrl.searchParams.set('client_id', HUBSPOT_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', HUBSPOT_REDIRECT_URI);
        authUrl.searchParams.set('scope', HUBSPOT_SCOPES);
        authUrl.searchParams.set('state', state);

        return NextResponse.redirect(authUrl.toString());
    } catch (error) {
        console.error('HubSpot OAuth initiation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
