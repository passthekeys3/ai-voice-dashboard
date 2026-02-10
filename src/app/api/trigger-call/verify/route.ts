/**
 * API Key Verification Endpoint
 *
 * GET /api/trigger-call/verify
 *
 * Lightweight endpoint for Zapier, Make.com, and other automation
 * platforms to verify API credentials during connection setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    // Extract Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' },
            { status: 401 },
        );
    }
    const apiKey = authHeader.slice(7);

    if (!apiKey || apiKey.length < 10) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Look up agency by API key
    const { data: agencies, error: agencyError } = await supabase
        .from('agencies')
        .select('id, name, integrations')
        .filter('integrations->api->>api_key', 'eq', apiKey);

    if (agencyError || !agencies || agencies.length === 0) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const agency = agencies[0];
    const apiConfig = agency.integrations?.api;

    if (!apiConfig?.enabled) {
        return NextResponse.json(
            { error: 'API trigger is not enabled for this agency' },
            { status: 403 },
        );
    }

    // Resolve default agent name if configured
    let defaultAgentName: string | null = null;
    if (apiConfig.default_agent_id) {
        const { data: agent } = await supabase
            .from('agents')
            .select('name')
            .eq('id', apiConfig.default_agent_id)
            .eq('agency_id', agency.id)
            .single();
        defaultAgentName = agent?.name || null;
    }

    return NextResponse.json({
        success: true,
        agency: agency.name,
        default_agent: defaultAgentName,
        enabled: true,
    });
}
