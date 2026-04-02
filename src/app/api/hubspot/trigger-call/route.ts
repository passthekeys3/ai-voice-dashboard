/**
 * HubSpot Outbound Trigger Webhook
 *
 * POST /api/hubspot/trigger-call
 *
 * Receives webhook POSTs from HubSpot workflows to initiate
 * outbound AI voice calls. Supports timezone-aware scheduling.
 *
 * Authentication: HubSpot v3 signature verification using
 * HUBSPOT_CLIENT_SECRET or per-agency webhook secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyHubSpotTriggerSignature, validateHubSpotTriggerPayload } from './validate';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { resolveTriggerAgency } from '@/lib/integrations/resolve-trigger-agency';
import { handleTriggerCall, type TriggerContext } from '@/lib/triggers/handler';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-hubspot-signature-v3');
        const timestamp = request.headers.get('x-hubspot-request-timestamp');

        // Parse payload
        let payload: unknown;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Validate payload schema
        const validation = validateHubSpotTriggerPayload(payload);
        if (!validation.success || !validation.data) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const data = validation.data;
        const supabase = createServiceClient();

        // Look up agency by HubSpot portal_id (agency-level first, then client-level fallback)
        const result = await resolveTriggerAgency(supabase, 'hubspot', 'portal_id', data.portal_id);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        const agency = result.agency;

        // ---- Tier gate: CRM integrations require Growth+ ----
        const tierError = checkFeatureAccess(agency.subscription_price_id, agency.subscription_status, 'crm_integrations', agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json(
                { error: tierError },
                { status: 403 },
            );
        }

        const hubspotConfig = agency.integrations?.hubspot;
        const triggerConfig = hubspotConfig?.trigger_config;

        // Verify trigger is enabled (before signature check, matching original behavior)
        if (!triggerConfig?.enabled) {
            return NextResponse.json(
                { error: 'HubSpot trigger is not enabled for this agency' },
                { status: 403 },
            );
        }

        // Verify webhook signature using the webhook secret
        const requestUrl = request.url;
        if (!verifyHubSpotTriggerSignature(rawBody, signature, timestamp, triggerConfig.webhook_secret, 'POST', requestUrl)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Build TriggerContext and delegate to shared handler
        // Note: triggerConfig.enabled is already verified above, but we still pass it
        // so the shared handler has access to default_agent_id.
        const ctx: TriggerContext = {
            supabase,
            agencyId: agency.id,
            triggerSource: 'hubspot_trigger',
            triggerConfig: triggerConfig ? { enabled: triggerConfig.enabled, default_agent_id: triggerConfig.default_agent_id } : undefined,
            callingWindow: agency.calling_window ?? null,
            phoneNumber: data.phone_number,
            contactName: data.contact_name,
            agentId: data.agent_id,
            fromNumber: data.from_number,
            scheduledAt: data.scheduled_at,
            metadata: data.metadata,
            crmContactId: data.contact_id,
            crmContactIdField: 'hubspot_contact_id',
            logTable: 'hubspot_trigger_log',
            extraCallMetadata: {
                hubspot_contact_id: data.contact_id,
                hubspot_portal_id: data.portal_id,
            },
            agencyKeys: {
                retell_api_key: agency.retell_api_key ?? null,
                vapi_api_key: agency.vapi_api_key ?? null,
                bland_api_key: agency.bland_api_key ?? null,
                elevenlabs_api_key: agency.elevenlabs_api_key ?? null,
            },
            requestPayload: data as unknown as Record<string, unknown>,
        };

        return handleTriggerCall(ctx);
    } catch (error) {
        console.error('HubSpot trigger-call error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
