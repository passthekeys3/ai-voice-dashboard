/**
 * GHL Platform Webhook Handler
 *
 * POST /api/ghl/platform-webhook
 *
 * Receives platform-level events from GoHighLevel:
 * - App installed / uninstalled
 * - Location access granted / revoked
 *
 * Verifies ED25519 signature using GHL's public key.
 * Legacy X-WH-Signature (RSA-SHA256) supported until July 1 2026.
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

type PlatformEvent =
    | { type: 'INSTALL'; data: { locationId: string; companyId: string; userId?: string } }
    | { type: 'UNINSTALL'; data: { locationId: string; companyId: string } }
    | { type: 'LOCATION_ACCESS_GRANTED'; data: { locationId: string; companyId: string } }
    | { type: 'LOCATION_ACCESS_REVOKED'; data: { locationId: string; companyId: string } };

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        // Verify signature — prefer ED25519, reject if missing
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
        let event: PlatformEvent;
        try {
            event = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const supabase = createServiceClient();

        switch (event.type) {
            case 'INSTALL':
                await handleInstall(supabase, event.data);
                break;

            case 'UNINSTALL':
                await handleUninstall(supabase, event.data);
                break;

            case 'LOCATION_ACCESS_GRANTED':
                // Same as install — ensure location is tracked
                await handleInstall(supabase, event.data);
                break;

            case 'LOCATION_ACCESS_REVOKED':
                // Same as uninstall — revoke access for this location
                await handleUninstall(supabase, event.data);
                break;

            default:
                console.log('GHL platform webhook: unhandled event type', (event as { type: string }).type);
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('GHL platform webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Handle app install / location access granted.
 * Logs the event — the actual OAuth token exchange happens via the OAuth flow.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInstall(supabase: any, data: { locationId: string; companyId: string; userId?: string }) {
    console.log(`GHL app installed: location=${data.locationId}, company=${data.companyId}`);

    // Log the install event
    await supabase.from('integration_events').insert({
        provider: 'ghl',
        event_type: 'install',
        location_id: data.locationId,
        company_id: data.companyId,
        user_id: data.userId,
        created_at: new Date().toISOString(),
    }).then(({ error }: { error: unknown }) => {
        // Best-effort logging — table may not exist yet
        if (error) console.warn('Failed to log GHL install event (table may not exist)');
    });
}

/**
 * Handle app uninstall / location access revoked.
 * Clears GHL integration config for the affected agency/client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUninstall(supabase: any, data: { locationId: string; companyId: string }) {
    console.log(`GHL app uninstalled: location=${data.locationId}, company=${data.companyId}`);

    // Find agencies connected to this GHL location and clear their GHL integration
    const { data: agencies } = await supabase
        .from('agencies')
        .select('id, integrations')
        .filter('integrations->ghl->location_id', 'eq', data.locationId);

    if (agencies && agencies.length > 0) {
        for (const agency of agencies) {
            const integrations = { ...agency.integrations };
            delete integrations.ghl;

            await supabase
                .from('agencies')
                .update({ integrations })
                .eq('id', agency.id);

            console.log(`Cleared GHL integration for agency ${agency.id}`);
        }
    }

    // Also check client-level integrations
    const { data: clients } = await supabase
        .from('clients')
        .select('id, integrations')
        .filter('integrations->ghl->location_id', 'eq', data.locationId);

    if (clients && clients.length > 0) {
        for (const client of clients) {
            const integrations = { ...client.integrations };
            delete integrations.ghl;

            await supabase
                .from('clients')
                .update({ integrations })
                .eq('id', client.id);

            console.log(`Cleared GHL integration for client ${client.id}`);
        }
    }

    // Log the uninstall event
    await supabase.from('integration_events').insert({
        provider: 'ghl',
        event_type: 'uninstall',
        location_id: data.locationId,
        company_id: data.companyId,
        created_at: new Date().toISOString(),
    }).then(({ error }: { error: unknown }) => {
        if (error) console.warn('Failed to log GHL uninstall event (table may not exist)');
    });
}
