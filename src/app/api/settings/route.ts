import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !isAgencyAdmin(user)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, branding, retell_api_key, vapi_api_key, integrations } = body;

        // Validate API key format and length
        const API_KEY_MAX_LENGTH = 256;
        // API keys typically contain alphanumeric chars, underscores, hyphens, and may have prefixes
        const API_KEY_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;

        if (retell_api_key) {
            if (typeof retell_api_key !== 'string' || retell_api_key.length > API_KEY_MAX_LENGTH) {
                return NextResponse.json({ error: 'Invalid Retell API key: too long' }, { status: 400 });
            }
            if (!API_KEY_PATTERN.test(retell_api_key)) {
                return NextResponse.json({ error: 'Invalid Retell API key format' }, { status: 400 });
            }
        }

        if (vapi_api_key) {
            if (typeof vapi_api_key !== 'string' || vapi_api_key.length > API_KEY_MAX_LENGTH) {
                return NextResponse.json({ error: 'Invalid Vapi API key: too long' }, { status: 400 });
            }
            if (!API_KEY_PATTERN.test(vapi_api_key)) {
                return NextResponse.json({ error: 'Invalid Vapi API key format' }, { status: 400 });
            }
        }

        // Validate GHL integration settings
        if (integrations?.ghl) {
            const ghl = integrations.ghl as Record<string, unknown>;
            if (ghl.api_key) {
                if (typeof ghl.api_key !== 'string' || (ghl.api_key as string).length > API_KEY_MAX_LENGTH) {
                    return NextResponse.json({ error: 'Invalid GHL API key: too long' }, { status: 400 });
                }
                if (!API_KEY_PATTERN.test(ghl.api_key as string)) {
                    return NextResponse.json({ error: 'Invalid GHL API key format' }, { status: 400 });
                }
            }
            if (ghl.location_id) {
                if (typeof ghl.location_id !== 'string' || (ghl.location_id as string).length > 100) {
                    return NextResponse.json({ error: 'Invalid GHL Location ID' }, { status: 400 });
                }
            }
            // OAuth fields (set via callback, validated here for safety)
            const TOKEN_MAX_LENGTH = 2048;
            if (ghl.access_token !== undefined) {
                if (typeof ghl.access_token !== 'string' || (ghl.access_token as string).length > TOKEN_MAX_LENGTH) {
                    return NextResponse.json({ error: 'Invalid GHL access token' }, { status: 400 });
                }
            }
            if (ghl.refresh_token !== undefined) {
                if (typeof ghl.refresh_token !== 'string' || (ghl.refresh_token as string).length > TOKEN_MAX_LENGTH) {
                    return NextResponse.json({ error: 'Invalid GHL refresh token' }, { status: 400 });
                }
            }
            if (ghl.auth_method !== undefined) {
                if (ghl.auth_method !== 'api_key' && ghl.auth_method !== 'oauth') {
                    return NextResponse.json({ error: 'Invalid GHL auth method' }, { status: 400 });
                }
            }
            if (ghl.oauth_location_id !== undefined) {
                if (typeof ghl.oauth_location_id !== 'string' || (ghl.oauth_location_id as string).length > 100) {
                    return NextResponse.json({ error: 'Invalid GHL OAuth location ID' }, { status: 400 });
                }
            }
            if (ghl.expires_at !== undefined) {
                if (typeof ghl.expires_at !== 'number' || (ghl.expires_at as number) < 0) {
                    return NextResponse.json({ error: 'Invalid GHL token expiry' }, { status: 400 });
                }
            }
        }

        // Validate HubSpot integration settings (OAuth tokens are set via callback, but validate if manually edited)
        if (integrations?.hubspot) {
            const hubspot = integrations.hubspot as { access_token?: string; refresh_token?: string; enabled?: boolean };
            // OAuth tokens can be longer and have different formats than API keys
            const TOKEN_MAX_LENGTH = 500;
            if (hubspot.access_token) {
                if (typeof hubspot.access_token !== 'string' || hubspot.access_token.length > TOKEN_MAX_LENGTH) {
                    return NextResponse.json({ error: 'Invalid HubSpot access token' }, { status: 400 });
                }
            }
            if (hubspot.refresh_token) {
                if (typeof hubspot.refresh_token !== 'string' || hubspot.refresh_token.length > TOKEN_MAX_LENGTH) {
                    return NextResponse.json({ error: 'Invalid HubSpot refresh token' }, { status: 400 });
                }
            }
            if (hubspot.enabled !== undefined && typeof hubspot.enabled !== 'boolean') {
                return NextResponse.json({ error: 'HubSpot enabled must be a boolean' }, { status: 400 });
            }
        }

        // Validate Google Calendar integration settings
        if (integrations?.google_calendar) {
            const gcal = integrations.google_calendar as Record<string, unknown>;
            if (gcal.access_token !== undefined) {
                if (typeof gcal.access_token !== 'string' || (gcal.access_token as string).length > 2048) {
                    return NextResponse.json({ error: 'Invalid Google Calendar access token' }, { status: 400 });
                }
            }
            if (gcal.refresh_token !== undefined) {
                if (typeof gcal.refresh_token !== 'string' || (gcal.refresh_token as string).length > 2048) {
                    return NextResponse.json({ error: 'Invalid Google Calendar refresh token' }, { status: 400 });
                }
            }
            if (gcal.enabled !== undefined && typeof gcal.enabled !== 'boolean') {
                return NextResponse.json({ error: 'Google Calendar enabled must be a boolean' }, { status: 400 });
            }
            if (gcal.default_calendar_id !== undefined) {
                if (typeof gcal.default_calendar_id !== 'string' || (gcal.default_calendar_id as string).length > 200) {
                    return NextResponse.json({ error: 'Invalid calendar ID' }, { status: 400 });
                }
            }
        }

        // Validate Slack integration settings
        if (integrations?.slack) {
            const slack = integrations.slack as Record<string, unknown>;
            if (slack.webhook_url !== undefined && slack.webhook_url !== '') {
                if (typeof slack.webhook_url !== 'string') {
                    return NextResponse.json({ error: 'Slack webhook URL must be a string' }, { status: 400 });
                }
                const url = slack.webhook_url as string;
                if (!url.startsWith('https://hooks.slack.com/') && !url.startsWith('https://hooks.slack-gov.com/')) {
                    return NextResponse.json({ error: 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/' }, { status: 400 });
                }
                if (url.length > 500) {
                    return NextResponse.json({ error: 'Slack webhook URL is too long' }, { status: 400 });
                }
            }
            if (slack.enabled !== undefined && typeof slack.enabled !== 'boolean') {
                return NextResponse.json({ error: 'Slack enabled must be a boolean' }, { status: 400 });
            }
            if (slack.channel_name !== undefined) {
                if (typeof slack.channel_name !== 'string' || (slack.channel_name as string).length > 100) {
                    return NextResponse.json({ error: 'Invalid Slack channel name' }, { status: 400 });
                }
            }
        }

        // Validate Calendly integration settings
        if (integrations?.calendly) {
            const calendly = integrations.calendly as Record<string, unknown>;
            if (calendly.api_token !== undefined && calendly.api_token !== '') {
                if (typeof calendly.api_token !== 'string' || (calendly.api_token as string).length > 500) {
                    return NextResponse.json({ error: 'Invalid Calendly API token' }, { status: 400 });
                }
            }
            if (calendly.enabled !== undefined && typeof calendly.enabled !== 'boolean') {
                return NextResponse.json({ error: 'Calendly enabled must be a boolean' }, { status: 400 });
            }
            if (calendly.user_uri !== undefined) {
                if (typeof calendly.user_uri !== 'string' || (calendly.user_uri as string).length > 500) {
                    return NextResponse.json({ error: 'Invalid Calendly user URI' }, { status: 400 });
                }
            }
            if (calendly.default_event_type_uri !== undefined) {
                if (typeof calendly.default_event_type_uri !== 'string' || (calendly.default_event_type_uri as string).length > 500) {
                    return NextResponse.json({ error: 'Invalid Calendly event type URI' }, { status: 400 });
                }
            }
        }

        // Validate API trigger settings
        if (integrations?.api) {
            const api = integrations.api as Record<string, unknown>;
            if (api.api_key !== undefined) {
                if (typeof api.api_key !== 'string' || !/^pdy_sk_[a-f0-9]{64}$/.test(api.api_key as string)) {
                    return NextResponse.json({ error: 'Invalid API trigger key format' }, { status: 400 });
                }
            }
            if (api.enabled !== undefined && typeof api.enabled !== 'boolean') {
                return NextResponse.json({ error: 'API trigger enabled must be a boolean' }, { status: 400 });
            }
            if (api.default_agent_id !== undefined && api.default_agent_id !== null) {
                if (typeof api.default_agent_id !== 'string') {
                    return NextResponse.json({ error: 'Invalid default agent ID' }, { status: 400 });
                }
            }
        }

        // Validate name if provided
        if (name !== undefined) {
            if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
                return NextResponse.json({ error: 'Agency name must be 1-100 characters' }, { status: 400 });
            }
        }

        // Use admin client to bypass RLS for agency update
        const supabase = await createAdminClient();

        // Build update payload — only include fields that were provided
        const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (name !== undefined) updatePayload.name = name;
        if (branding !== undefined) updatePayload.branding = branding;
        if (retell_api_key !== undefined) updatePayload.retell_api_key = retell_api_key || null;
        if (vapi_api_key !== undefined) updatePayload.vapi_api_key = vapi_api_key || null;

        // Deep merge integrations to prevent overwriting sibling keys (e.g., GHL when updating HubSpot)
        if (integrations !== undefined) {
            const { data: current } = await supabase
                .from('agencies')
                .select('integrations')
                .eq('id', user.agency.id)
                .single();

            const existingIntegrations = (current?.integrations as Record<string, unknown>) || {};
            const mergedIntegrations: Record<string, unknown> = { ...existingIntegrations };

            for (const [key, value] of Object.entries(integrations)) {
                if (typeof value === 'object' && value !== null && typeof existingIntegrations[key] === 'object') {
                    mergedIntegrations[key] = { ...(existingIntegrations[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
                } else {
                    mergedIntegrations[key] = value;
                }
            }

            updatePayload.integrations = mergedIntegrations;
        }

        const { error } = await supabase
            .from('agencies')
            .update(updatePayload)
            .eq('id', user.agency.id);

        if (error) {
            console.error('Settings update error:', error);
            return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
