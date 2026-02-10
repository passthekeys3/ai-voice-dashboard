/**
 * Calendly Token Validation Endpoint
 *
 * POST /api/integrations/calendly/validate
 * Validates a Calendly Personal Access Token and returns user info + event types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAgencyAdmin } from '@/lib/auth';
import { getCurrentUser as getCalendlyUser, getEventTypes } from '@/lib/integrations/calendly';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user || !isAgencyAdmin(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { api_token?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const apiToken = body.api_token?.trim();
    if (!apiToken) {
        return NextResponse.json({ error: 'api_token is required' }, { status: 400 });
    }

    // Validate token by fetching current user
    const config = { apiToken };
    const userResult = await getCalendlyUser(config);

    if (userResult.error || !userResult.data) {
        return NextResponse.json(
            { error: userResult.error || 'Invalid Calendly token' },
            { status: 400 },
        );
    }

    // Fetch event types for the user
    const eventTypesResult = await getEventTypes(config, userResult.data.uri);

    return NextResponse.json({
        success: true,
        user: {
            uri: userResult.data.uri,
            name: userResult.data.name,
            email: userResult.data.email,
            timezone: userResult.data.timezone,
        },
        event_types: (eventTypesResult.data || []).map(et => ({
            uri: et.uri,
            name: et.name,
            duration: et.duration,
            scheduling_url: et.scheduling_url,
            active: et.active,
        })),
    });
}
