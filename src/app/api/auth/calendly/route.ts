import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { signOAuthState, validateClientOwnership } from '@/lib/auth/oauth-helpers';

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const CALENDLY_REDIRECT_URI = process.env.CALENDLY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/calendly/callback`;

/**
 * GET /api/auth/calendly - Initiate Calendly OAuth flow or disconnect
 *
 * Supports both agency-level and per-client:
 *   /api/auth/calendly                     → agency-level
 *   /api/auth/calendly?clientId=xxx        → client-level
 *   /api/auth/calendly?action=disconnect   → disconnect
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const clientId = searchParams.get('clientId');

        // Validate client ownership if clientId provided
        if (clientId) {
            const supabase = await createAdminClient();
            if (!await validateClientOwnership(supabase, clientId, user.agency.id)) {
                return NextResponse.json({ error: 'Client not found' }, { status: 404 });
            }
        }

        const redirectBase = clientId ? `/clients/${clientId}` : '/settings';

        // Disconnect
        if (action === 'disconnect') {
            const supabase = await createAdminClient();

            if (clientId) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('integrations')
                    .eq('id', clientId)
                    .eq('agency_id', user.agency.id)
                    .single();

                const clientIntegrations = (client?.integrations as Record<string, unknown>) || {};
                const { calendly: _removed, ...rest } = clientIntegrations;

                const { error: updateError } = await supabase
                    .from('clients')
                    .update({
                        integrations: Object.keys(rest).length > 0 ? rest : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', clientId)
                    .eq('agency_id', user.agency.id);

                if (updateError) {
                    console.error('Failed to disconnect Calendly for client:', updateError.code);
                    return NextResponse.redirect(new URL(`${redirectBase}?calendly=error&message=Failed+to+disconnect`, request.url));
                }
            } else {
                const { data: agency } = await supabase
                    .from('agencies')
                    .select('integrations')
                    .eq('id', user.agency.id)
                    .single();

                const updatedIntegrations = {
                    ...agency?.integrations,
                    calendly: {
                        ...agency?.integrations?.calendly,
                        access_token: null,
                        refresh_token: null,
                        expires_at: null,
                        user_uri: null,
                        organization_uri: null,
                        enabled: false,
                    },
                };

                const { error: updateError } = await supabase
                    .from('agencies')
                    .update({
                        integrations: updatedIntegrations,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', user.agency.id);

                if (updateError) {
                    console.error('Failed to disconnect Calendly:', updateError.code);
                    return NextResponse.redirect(new URL(`${redirectBase}?calendly=error&message=Failed+to+disconnect`, request.url));
                }
            }

            return NextResponse.redirect(new URL(`${redirectBase}?calendly=disconnected`, request.url));
        }

        // Tier gate
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'crm_integrations', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        if (!CALENDLY_CLIENT_ID || !CALENDLY_CLIENT_SECRET) {
            return NextResponse.json(
                { error: 'Calendly OAuth not configured. Please set CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET.' },
                { status: 500 }
            );
        }

        const state = signOAuthState({ agencyId: user.agency.id, clientId }, CALENDLY_CLIENT_SECRET);

        const authUrl = new URL('https://auth.calendly.com/oauth/authorize');
        authUrl.searchParams.set('client_id', CALENDLY_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', CALENDLY_REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', state);

        return NextResponse.redirect(authUrl.toString());
    } catch (error) {
        console.error('Calendly OAuth initiation error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
