/**
 * GHL Platform Webhook Handler
 *
 * POST /api/ghl/platform-webhook
 *
 * Receives platform-level events from GoHighLevel:
 * - Location created / updated
 *
 * Verifies ED25519 signature using GHL's public key.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GHL's static ED25519 public key for webhook signature verification
const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

/**
 * Verify ED25519 signature from X-GHL-Signature header
 */
function verifyED25519Signature(rawBody: string, signature: string): boolean {
    try {
        const payloadBuffer = Buffer.from(rawBody, 'utf8');
        const signatureBuffer = Buffer.from(signature, 'base64');
        return crypto.verify(null, payloadBuffer, GHL_ED25519_PUBLIC_KEY, signatureBuffer);
    } catch {
        return false;
    }
}

interface LocationEvent {
    type: string;
    locationId: string;
    companyId: string;
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
    timezone?: string;
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        // Verify ED25519 signature
        const ed25519Sig = request.headers.get('x-ghl-signature');

        if (!ed25519Sig) {
            console.warn('GHL platform webhook: no signature header');
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        if (!verifyED25519Signature(rawBody, ed25519Sig)) {
            console.warn('GHL platform webhook: invalid ED25519 signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Parse payload
        let event: LocationEvent;
        try {
            event = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const supabase = createServiceClient();

        switch (event.type) {
            case 'LocationCreate':
                await handleLocationCreate(supabase, event);
                break;

            case 'LocationUpdate':
                await handleLocationUpdate(supabase, event);
                break;

            default:
                console.log('GHL platform webhook: unhandled event type', event.type);
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('GHL platform webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Handle new GHL location created.
 * Logs the event for awareness — no auto-provisioning needed.
 * The agency/client connects via OAuth when they're ready.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleLocationCreate(supabase: any, event: LocationEvent) {
    console.log(`GHL location created: id=${event.locationId}, name=${event.name}, company=${event.companyId}`);

    await supabase.from('integration_events').insert({
        provider: 'ghl',
        event_type: 'location_create',
        location_id: event.locationId,
        company_id: event.companyId,
        metadata: {
            name: event.name,
            address: event.address,
            city: event.city,
            state: event.state,
            country: event.country,
            phone: event.phone,
            email: event.email,
            timezone: event.timezone,
        },
        created_at: new Date().toISOString(),
    }).then(({ error }: { error: unknown }) => {
        if (error) console.warn('Failed to log GHL location create event (table may not exist)');
    });
}

/**
 * Handle GHL location updated.
 * If this location is connected to an agency or client, sync the updated info.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleLocationUpdate(supabase: any, event: LocationEvent) {
    console.log(`GHL location updated: id=${event.locationId}, name=${event.name}`);

    // Check if any agency or client is connected to this location
    // and update their stored location metadata if so
    const { data: agencies } = await supabase
        .from('agencies')
        .select('id, integrations')
        .filter('integrations->ghl->location_id', 'eq', event.locationId);

    if (agencies && agencies.length > 0) {
        for (const agency of agencies) {
            const integrations = { ...agency.integrations };
            if (integrations.ghl) {
                integrations.ghl.location_name = event.name;
                integrations.ghl.location_timezone = event.timezone;

                await supabase
                    .from('agencies')
                    .update({ integrations })
                    .eq('id', agency.id);

                console.log(`Synced GHL location update for agency ${agency.id}`);
            }
        }
    }

    // Also sync client-level integrations
    const { data: clients } = await supabase
        .from('clients')
        .select('id, integrations')
        .filter('integrations->ghl->location_id', 'eq', event.locationId);

    if (clients && clients.length > 0) {
        for (const client of clients) {
            const integrations = { ...client.integrations };
            if (integrations.ghl) {
                integrations.ghl.location_name = event.name;
                integrations.ghl.location_timezone = event.timezone;

                await supabase
                    .from('clients')
                    .update({ integrations })
                    .eq('id', client.id);

                console.log(`Synced GHL location update for client ${client.id}`);
            }
        }
    }

    // Log the event
    await supabase.from('integration_events').insert({
        provider: 'ghl',
        event_type: 'location_update',
        location_id: event.locationId,
        company_id: event.companyId,
        metadata: {
            name: event.name,
            timezone: event.timezone,
        },
        created_at: new Date().toISOString(),
    }).then(({ error }: { error: unknown }) => {
        if (error) console.warn('Failed to log GHL location update event (table may not exist)');
    });
}
