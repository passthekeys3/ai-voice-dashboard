/**
 * Generic Outbound Trigger API
 *
 * POST /api/trigger-call
 *
 * Platform-agnostic endpoint for triggering outbound AI voice calls.
 * Designed for Make.com, n8n, Zapier, and custom HTTP integrations.
 *
 * Authentication: Bearer token API key in Authorization header.
 * The API key is generated per-agency in Settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateApiTriggerPayload } from './validate';
import { checkFeatureAccess } from '@/lib/billing/tiers';
import { PROVIDER_KEY_SELECT, type ProviderKeyRow } from '@/lib/constants/config';
import { handleTriggerCall, type TriggerContext } from '@/lib/triggers/handler';

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        // Extract Bearer token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' },
                { status: 401 },
            );
        }
        const apiKey = authHeader.slice(7); // Remove 'Bearer '

        if (!apiKey || apiKey.length < 10) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        // Parse payload
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Validate payload schema
        const validation = validateApiTriggerPayload(payload);
        if (!validation.success || !validation.data) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const data = validation.data;
        const supabase = createServiceClient();

        // Look up agency by API key
        const { data: agencies, error: agencyError } = await supabase
            .from('agencies')
            .select(`id, integrations, calling_window, ${PROVIDER_KEY_SELECT}, subscription_price_id, subscription_status, beta_ends_at`)
            .filter('integrations->api->>api_key', 'eq', apiKey) as {
                data: (ProviderKeyRow & {
                    id: string;
                    integrations: { api?: { enabled?: boolean; api_key?: string; default_agent_id?: string } } | null;
                    calling_window: { enabled?: boolean; start_hour: number; end_hour: number; days_of_week: number[] } | null;
                    subscription_price_id: string | null;
                    subscription_status: string | null;
                    beta_ends_at: string | null;
                })[] | null;
                error: { code: string } | null;
            };

        if (agencyError || !agencies || agencies.length === 0) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 },
            );
        }

        if (agencies.length > 1) {
            console.error(`SECURITY: Multiple agencies matched API key: ${agencies.map(a => a.id).join(', ')}`);
            return NextResponse.json(
                { error: 'Configuration error — contact support' },
                { status: 500 },
            );
        }

        const agency = agencies[0];

        // ---- Tier gate: API access requires Agency plan ----
        const tierError = checkFeatureAccess(agency.subscription_price_id, agency.subscription_status, 'api_access', agency.beta_ends_at);
        if (tierError) {
            return NextResponse.json(
                { error: tierError },
                { status: 403 },
            );
        }

        const apiConfig = agency.integrations?.api;

        // Build TriggerContext and delegate to shared handler
        const ctx: TriggerContext = {
            supabase,
            agencyId: agency.id,
            triggerSource: 'api_trigger',
            triggerConfig: apiConfig ? { enabled: apiConfig.enabled, default_agent_id: apiConfig.default_agent_id } : undefined,
            callingWindow: agency.calling_window as TriggerContext['callingWindow'],
            phoneNumber: data.phone_number,
            contactName: data.contact_name,
            agentId: data.agent_id,
            fromNumber: data.from_number,
            scheduledAt: data.scheduled_at,
            metadata: data.metadata,
            logTable: 'api_trigger_log',
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
        console.error('API trigger-call error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
