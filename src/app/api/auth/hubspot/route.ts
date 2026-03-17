import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import crypto from 'crypto';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`;

// OAuth scopes — split into required vs optional per HubSpot's
// advanced scope settings (mandatory since Oct 2024).
// Required: always needed for core contact sync.
// Optional: deals access — not all HubSpot plans include deals.
const HUBSPOT_REQUIRED_SCOPES = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
].join(' ');

const HUBSPOT_OPTIONAL_SCOPES = [
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    'crm.schemas.contacts.read',
].join(' ');

/**
 * GET /api/auth/hubspot - Initiate HubSpot OAuth flow
 *
 * Supports both agency-level and per-client OAuth:
 *   /api/auth/hubspot                     → agency-level
 *   /api/auth/hubspot?clientId=xxx        → client-level
 *   /api/auth/hubspot?action=disconnect   → disconnect agency
 *   /api/auth/hubspot?action=disconnect&clientId=xxx → disconnect client
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

        // If clientId provided, validate it belongs to this agency
        if (clientId) {
            const supabase = await createAdminClient();
            const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('id', clientId)
                .eq('agency_id', user.agency.id)
                .single();

            if (!client) {
                return NextResponse.json({ error: 'Client not found' }, { status: 404 });
            }
        }

        const redirectBase = clientId ? `/clients/${clientId}` : '/settings';

        // Allow disconnect regardless of tier (don't strand users)
        if (action === 'disconnect') {
            const supabase = await createAdminClient();

            if (clientId) {
                // Disconnect at client level — remove client's HubSpot override
                const { data: client } = await supabase
                    .from('clients')
                    .select('integrations')
                    .eq('id', clientId)
                    .eq('agency_id', user.agency.id)
                    .single();

                const clientIntegrations = (client?.integrations as Record<string, unknown>) || {};
                const { hubspot: _removed, ...rest } = clientIntegrations;

                await supabase
                    .from('clients')
                    .update({
                        integrations: Object.keys(rest).length > 0 ? rest : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', clientId)
                    .eq('agency_id', user.agency.id);
            } else {
                // Disconnect at agency level
                const { data: agency } = await supabase
                    .from('agencies')
                    .select('integrations')
                    .eq('id', user.agency.id)
                    .single();

                // Clear OAuth tokens but preserve trigger_config, portal_id, webhook_secret
                const updatedIntegrations = {
                    ...agency?.integrations,
                    hubspot: {
                        ...agency?.integrations?.hubspot,
                        access_token: null,
                        refresh_token: null,
                        expires_at: null,
                        enabled: false,
                    },
                };

                await supabase
                    .from('agencies')
                    .update({
                        integrations: updatedIntegrations,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', user.agency.id);
            }

            return NextResponse.redirect(new URL(`${redirectBase}?hubspot=disconnected`, request.url));
        }

        // ---- Tier gate: CRM integrations require Growth+ ----
        const tierError = checkFeatureAccess(user.agency.subscription_price_id, user.agency.subscription_status, 'crm_integrations', user.agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json({ error: tierError }, { status: 403 });
        }

        // Check if HubSpot OAuth is configured
        if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
            return NextResponse.json(
                { error: 'HubSpot OAuth not configured. Please set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET environment variables.' },
                { status: 500 }
            );
        }

        // Generate state parameter for CSRF protection with HMAC signature
        // Include clientId when doing per-client OAuth
        const statePayload = JSON.stringify({
            agencyId: user.agency.id,
            ...(clientId ? { clientId } : {}),
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
        authUrl.searchParams.set('scope', HUBSPOT_REQUIRED_SCOPES);
        authUrl.searchParams.set('optional_scope', HUBSPOT_OPTIONAL_SCOPES);
        authUrl.searchParams.set('state', state);

        return NextResponse.redirect(authUrl.toString());
    } catch (error) {
        console.error('HubSpot OAuth initiation error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
