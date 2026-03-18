/**
 * GHL Platform Webhook Handler
 *
 * POST /api/ghl/platform-webhook
 *
 * Receives platform-level events from GoHighLevel:
 * - Location created / updated
 * - Contact created / updated
 * - Opportunity created / status updated
 * - Note created
 * - Task created
 * - Appointment created
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface GHLWebhookEvent {
    type: string;
    locationId: string;
    companyId?: string;
    id?: string;
    // Location fields
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
    // Contact fields
    contactId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    // Opportunity fields
    opportunityId?: string;
    pipelineId?: string;
    pipelineStageId?: string;
    status?: string;
    monetaryValue?: number;
    // Note fields
    body?: string;
    // Task fields
    title?: string;
    dueDate?: string;
    assignedTo?: string;
    // Appointment fields
    appointmentStatus?: string;
    startTime?: string;
    endTime?: string;
    calendarId?: string;
    // Generic
    [key: string]: unknown;
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
        let event: GHLWebhookEvent;
        try {
            event = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const supabase = createServiceClient();

        switch (event.type) {
            // Location events
            case 'LocationCreate':
                await handleLocationCreate(supabase, event);
                break;
            case 'LocationUpdate':
                await handleLocationUpdate(supabase, event);
                break;

            // Contact events
            case 'ContactCreate':
            case 'ContactUpdate':
                await handleContactEvent(supabase, event);
                break;

            // Opportunity events
            case 'OpportunityCreate':
            case 'OpportunityStatusUpdate':
                await handleOpportunityEvent(supabase, event);
                break;

            // Activity events
            case 'NoteCreate':
                await handleNoteCreate(supabase, event);
                break;
            case 'TaskCreate':
                await handleTaskCreate(supabase, event);
                break;
            case 'AppointmentCreate':
                await handleAppointmentCreate(supabase, event);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the agency or client connected to a GHL location.
 * Returns { agencyId, clientId } if found.
 */
async function findConnectedAccount(supabase: SupabaseClient, locationId: string) {
    // Check client-level first (more specific)
    const { data: clients } = await supabase
        .from('clients')
        .select('id, agency_id, integrations')
        .filter('integrations->ghl->location_id', 'eq', locationId)
        .limit(1);

    if (clients && clients.length > 0) {
        return { agencyId: clients[0].agency_id, clientId: clients[0].id };
    }

    // Fall back to agency-level
    const { data: agencies } = await supabase
        .from('agencies')
        .select('id, integrations')
        .filter('integrations->ghl->location_id', 'eq', locationId)
        .limit(1);

    if (agencies && agencies.length > 0) {
        return { agencyId: agencies[0].id, clientId: null };
    }

    return null;
}

/**
 * Best-effort log to integration_events table.
 */
async function logEvent(supabase: SupabaseClient, data: {
    provider: string;
    event_type: string;
    location_id: string;
    company_id?: string;
    agency_id?: string;
    client_id?: string;
    metadata?: Record<string, unknown>;
}) {
    await supabase.from('integration_events').insert({
        ...data,
        created_at: new Date().toISOString(),
    }).then(({ error }: { error: unknown }) => {
        if (error) console.warn(`Failed to log GHL ${data.event_type} event (table may not exist)`);
    });
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleLocationCreate(supabase: SupabaseClient, event: GHLWebhookEvent) {
    console.log(`GHL location created: id=${event.locationId}, name=${event.name}`);

    await logEvent(supabase, {
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
    });
}

async function handleLocationUpdate(supabase: SupabaseClient, event: GHLWebhookEvent) {
    console.log(`GHL location updated: id=${event.locationId}, name=${event.name}`);

    // Sync updated location info to connected agencies
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
                await supabase.from('agencies').update({ integrations }).eq('id', agency.id);
                console.log(`Synced GHL location update for agency ${agency.id}`);
            }
        }
    }

    // Sync to connected clients
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
                await supabase.from('clients').update({ integrations }).eq('id', client.id);
                console.log(`Synced GHL location update for client ${client.id}`);
            }
        }
    }

    await logEvent(supabase, {
        provider: 'ghl',
        event_type: 'location_update',
        location_id: event.locationId,
        company_id: event.companyId,
        metadata: { name: event.name, timezone: event.timezone },
    });
}

async function handleContactEvent(supabase: SupabaseClient, event: GHLWebhookEvent) {
    const isCreate = event.type === 'ContactCreate';
    console.log(`GHL contact ${isCreate ? 'created' : 'updated'}: ${event.contactId} in location ${event.locationId}`);

    const account = await findConnectedAccount(supabase, event.locationId);
    if (!account) {
        console.log(`GHL contact event: no connected account for location ${event.locationId}`);
        return;
    }

    await logEvent(supabase, {
        provider: 'ghl',
        event_type: isCreate ? 'contact_create' : 'contact_update',
        location_id: event.locationId,
        agency_id: account.agencyId,
        client_id: account.clientId ?? undefined,
        metadata: {
            contact_id: event.contactId,
            first_name: event.firstName,
            last_name: event.lastName,
            email: event.email,
            phone: event.phone,
            tags: event.tags,
        },
    });
}

async function handleOpportunityEvent(supabase: SupabaseClient, event: GHLWebhookEvent) {
    const isCreate = event.type === 'OpportunityCreate';
    console.log(`GHL opportunity ${isCreate ? 'created' : 'status updated'}: ${event.opportunityId} in location ${event.locationId}`);

    const account = await findConnectedAccount(supabase, event.locationId);
    if (!account) {
        console.log(`GHL opportunity event: no connected account for location ${event.locationId}`);
        return;
    }

    await logEvent(supabase, {
        provider: 'ghl',
        event_type: isCreate ? 'opportunity_create' : 'opportunity_status_update',
        location_id: event.locationId,
        agency_id: account.agencyId,
        client_id: account.clientId ?? undefined,
        metadata: {
            opportunity_id: event.opportunityId,
            contact_id: event.contactId,
            pipeline_id: event.pipelineId,
            stage_id: event.pipelineStageId,
            status: event.status,
            monetary_value: event.monetaryValue,
            name: event.name,
        },
    });
}

async function handleNoteCreate(supabase: SupabaseClient, event: GHLWebhookEvent) {
    console.log(`GHL note created in location ${event.locationId}`);

    const account = await findConnectedAccount(supabase, event.locationId);
    if (!account) return;

    await logEvent(supabase, {
        provider: 'ghl',
        event_type: 'note_create',
        location_id: event.locationId,
        agency_id: account.agencyId,
        client_id: account.clientId ?? undefined,
        metadata: {
            contact_id: event.contactId,
            body: typeof event.body === 'string' ? event.body.slice(0, 500) : undefined,
        },
    });
}

async function handleTaskCreate(supabase: SupabaseClient, event: GHLWebhookEvent) {
    console.log(`GHL task created in location ${event.locationId}`);

    const account = await findConnectedAccount(supabase, event.locationId);
    if (!account) return;

    await logEvent(supabase, {
        provider: 'ghl',
        event_type: 'task_create',
        location_id: event.locationId,
        agency_id: account.agencyId,
        client_id: account.clientId ?? undefined,
        metadata: {
            contact_id: event.contactId,
            title: event.title,
            due_date: event.dueDate,
            assigned_to: event.assignedTo,
        },
    });
}

async function handleAppointmentCreate(supabase: SupabaseClient, event: GHLWebhookEvent) {
    console.log(`GHL appointment created in location ${event.locationId}`);

    const account = await findConnectedAccount(supabase, event.locationId);
    if (!account) return;

    await logEvent(supabase, {
        provider: 'ghl',
        event_type: 'appointment_create',
        location_id: event.locationId,
        agency_id: account.agencyId,
        client_id: account.clientId ?? undefined,
        metadata: {
            contact_id: event.contactId,
            calendar_id: event.calendarId,
            status: event.appointmentStatus,
            start_time: event.startTime,
            end_time: event.endTime,
            title: event.title,
        },
    });
}
