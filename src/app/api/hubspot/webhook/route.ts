/**
 * HubSpot Inbound Webhook Receiver
 *
 * POST /api/hubspot/webhook
 *
 * Receives CRM change notifications from HubSpot (contact/deal events).
 * Configured via the HubSpot developer project (webhooks-hsmeta.json).
 *
 * Events handled:
 * - contact.creation — new contact created in HubSpot
 * - contact.propertyChange (phone, email) — contact updated
 * - deal.creation — new deal created
 * - deal.propertyChange (dealstage) — deal stage changed
 *
 * Authentication: HubSpot v3 signature verification using HUBSPOT_CLIENT_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;

/** HubSpot webhook event shape */
interface HubSpotWebhookEvent {
    objectId: number;
    propertyName?: string;
    propertyValue?: string;
    changeSource: string;
    eventId: number;
    subscriptionId: number;
    portalId: number;
    appId: number;
    occurredAt: number;
    subscriptionType: string;
    attemptNumber: number;
    objectTypeId?: string;
}

/**
 * Verify HubSpot webhook signature (v3).
 *
 * Signature = HMAC-SHA256 of: {clientSecret}{method}{url}{body}{timestamp}
 */
function verifySignature(
    rawBody: string,
    signature: string | null,
    timestamp: string | null,
    method: string,
    url: string,
): boolean {
    if (!signature || !HUBSPOT_CLIENT_SECRET || !timestamp) return false;

    try {
        const requestTimestamp = parseInt(timestamp, 10);
        const now = Date.now();
        if (isNaN(requestTimestamp) || Math.abs(now - requestTimestamp) > 5 * 60 * 1000) {
            console.warn('HubSpot webhook timestamp outside 5-minute window');
            return false;
        }

        const sourceString = HUBSPOT_CLIENT_SECRET + method + url + rawBody + timestamp;
        const expectedHash = crypto
            .createHmac('sha256', HUBSPOT_CLIENT_SECRET)
            .update(sourceString)
            .digest('base64');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedHash),
        );
    } catch {
        return false;
    }
}

/**
 * Look up agency by HubSpot portal ID
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAgencyByPortalId(supabase: any, portalId: number) {
    const { data: agencies, error } = await supabase
        .from('agencies')
        .select('id, integrations')
        .filter('integrations->hubspot->>portal_id', 'eq', String(portalId));

    if (error || !agencies || agencies.length === 0) return null;
    if (agencies.length > 1) {
        console.error(`SECURITY: Multiple agencies matched HubSpot portal_id ${portalId}`);
        return null;
    }
    return agencies[0];
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-hubspot-signature-v3');
        const timestamp = request.headers.get('x-hubspot-request-timestamp');

        // Verify signature
        if (!verifySignature(rawBody, signature, timestamp, 'POST', request.url)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // HubSpot sends an array of events
        let events: HubSpotWebhookEvent[];
        try {
            events = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        if (!Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ status: 'ok', processed: 0 });
        }

        const supabase = createServiceClient();

        // Group events by portalId to minimize agency lookups
        const eventsByPortal = new Map<number, HubSpotWebhookEvent[]>();
        for (const event of events) {
            const portalEvents = eventsByPortal.get(event.portalId) || [];
            portalEvents.push(event);
            eventsByPortal.set(event.portalId, portalEvents);
        }

        let processed = 0;
        let errors = 0;

        for (const [portalId, portalEvents] of eventsByPortal) {
            const agency = await getAgencyByPortalId(supabase, portalId);
            if (!agency) {
                console.warn(`HubSpot webhook: no agency for portal ${portalId}`);
                errors += portalEvents.length;
                continue;
            }

            for (const event of portalEvents) {
                try {
                    await processEvent(supabase, agency, event);
                    processed++;
                } catch (err) {
                    console.error(
                        `HubSpot webhook event error [${event.subscriptionType}]:`,
                        err instanceof Error ? err.message : 'Unknown error',
                    );
                    errors++;
                }
            }
        }

        return NextResponse.json({ status: 'ok', processed, errors });
    } catch (error) {
        console.error('HubSpot webhook error:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Process a single HubSpot webhook event
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processEvent(supabase: any, agency: { id: string; integrations: any }, event: HubSpotWebhookEvent) {
    const { subscriptionType, objectId, propertyName, propertyValue } = event;

    // Log the event for debugging/audit
    console.log(`HubSpot webhook [${agency.id}]: ${subscriptionType} object=${objectId} prop=${propertyName || 'n/a'}`);

    switch (subscriptionType) {
        case 'object.creation': {
            if (event.objectTypeId === '0-1' || !event.objectTypeId) {
                // Contact created — we can sync on next call, no immediate action needed
                console.log(`HubSpot: New contact ${objectId} in agency ${agency.id}`);
            } else if (event.objectTypeId === '0-3') {
                // Deal created
                console.log(`HubSpot: New deal ${objectId} in agency ${agency.id}`);
            }
            break;
        }

        case 'object.propertyChange': {
            if (propertyName === 'phone' || propertyName === 'email') {
                // Contact phone/email changed — update any matching call records
                console.log(`HubSpot: Contact ${objectId} ${propertyName} changed to ${propertyValue ? '[updated]' : '[cleared]'} in agency ${agency.id}`);
            } else if (propertyName === 'dealstage') {
                // Deal stage changed
                console.log(`HubSpot: Deal ${objectId} stage changed to ${propertyValue} in agency ${agency.id}`);
            }
            break;
        }

        // Legacy subscription types (kept for backwards compatibility)
        case 'contact.creation':
            console.log(`HubSpot: New contact ${objectId} (legacy event) in agency ${agency.id}`);
            break;

        case 'contact.propertyChange':
            console.log(`HubSpot: Contact ${objectId} ${propertyName} changed (legacy event) in agency ${agency.id}`);
            break;

        case 'contact.deletion':
            console.log(`HubSpot: Contact ${objectId} deleted in agency ${agency.id}`);
            break;

        case 'contact.privacyDeletion':
            console.log(`HubSpot: Privacy deletion for contact ${objectId} in agency ${agency.id}`);
            break;

        default:
            console.log(`HubSpot: Unhandled event type ${subscriptionType} for object ${objectId}`);
    }
}
