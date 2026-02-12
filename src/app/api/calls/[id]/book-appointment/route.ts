/**
 * Live Call Appointment Booking
 *
 * POST /api/calls/:id/book-appointment
 *
 * Called by Retell/Vapi function calling during live calls to book
 * appointments in GHL calendars. The AI agent can relay the booked
 * appointment details back to the caller in real-time.
 *
 * Authentication: requires LIVE_CALL_API_SECRET header since this is
 * called by the voice provider, not by an authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { bookNextAvailableAppointment, getCalendarFreeSlots, createAppointment, searchContactByPhone, createContact } from '@/lib/integrations/ghl';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Validate shared secret to prevent unauthorized access
        const apiSecret = process.env.LIVE_CALL_API_SECRET;
        const providedSecret = request.headers.get('x-api-secret');

        if (!apiSecret || !providedSecret || apiSecret !== providedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: callId } = await params;
        const body = await request.json();

        const {
            calendar_id,
            preferred_date,     // ISO date string (optional)
            preferred_time,     // HH:MM format (optional)
            timezone,           // IANA timezone (optional)
            contact_phone,      // Phone number (optional override)
            contact_name,       // Contact name (optional)
            duration_minutes,   // Appointment duration (optional, default 30)
        } = body;

        const supabase = createServiceClient();

        // Look up the call to find the agency and agent
        const { data: call } = await supabase
            .from('calls')
            .select('id, agent_id, from_number, to_number, direction, lead_timezone, agents(agency_id, agencies(integrations))')
            .eq('external_id', callId)
            .single();

        // Also try by internal ID if external_id didn't match
        const callRecord = call || (await supabase
            .from('calls')
            .select('id, agent_id, from_number, to_number, direction, lead_timezone, agents(agency_id, agencies(integrations))')
            .eq('id', callId)
            .single()).data;

        if (!callRecord) {
            return NextResponse.json({ error: 'Call not found' }, { status: 404 });
        }

        // Extract agency GHL config
        type CallWithAgent = typeof callRecord & {
            agents: { agency_id: string; agencies: { integrations: { ghl?: { api_key?: string; location_id?: string; enabled?: boolean } } } };
        };
        const callAgent = callRecord as CallWithAgent;
        const ghlIntegration = callAgent.agents?.agencies?.integrations?.ghl;

        if (!ghlIntegration?.enabled || !ghlIntegration.api_key) {
            return NextResponse.json(
                { error: 'GoHighLevel is not configured for this agency' },
                { status: 400 },
            );
        }

        const ghlConfig = {
            apiKey: ghlIntegration.api_key,
            locationId: ghlIntegration.location_id || '',
        };

        // Determine phone number (inbound: from_number, outbound: to_number)
        const phoneNumber = contact_phone
            || (callRecord.direction === 'inbound' ? callRecord.from_number : callRecord.to_number);

        if (!phoneNumber) {
            return NextResponse.json({ error: 'No phone number available' }, { status: 400 });
        }

        // Use the preferred date/time approach if provided
        if (preferred_date || preferred_time) {
            // Find or create contact
            let contact = await searchContactByPhone(ghlConfig, phoneNumber);
            if (!contact) {
                contact = await createContact(ghlConfig, {
                    phone: phoneNumber,
                    firstName: contact_name || 'Unknown',
                    source: 'BuildVoiceAI Call',
                    tags: ['ai-voice-call', 'appointment-booked'],
                });
            }

            if (!contact) {
                return NextResponse.json({ error: 'Failed to find or create contact' }, { status: 500 });
            }

            const calendarId = calendar_id;
            if (!calendarId) {
                return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
            }

            // If specific date provided, get free slots for that date
            const targetDate = preferred_date ? new Date(preferred_date) : new Date();
            const endDate = new Date(targetDate);
            endDate.setDate(endDate.getDate() + 1);

            const tz = timezone || callRecord.lead_timezone || undefined;
            const slots = await getCalendarFreeSlots(ghlConfig, calendarId, targetDate, endDate, tz);

            // Find a matching slot
            let selectedSlot: { startTime: string; endTime: string } | null = null;
            const allSlots = Object.values(slots).flat();

            if (preferred_time && allSlots.length > 0) {
                // Try to find a slot closest to the preferred time
                const [prefHour, prefMin] = preferred_time.split(':').map(Number);
                const prefMinutes = prefHour * 60 + (prefMin || 0);
                let bestDiff = Infinity;

                for (const slot of allSlots) {
                    const slotDate = new Date(slot.startTime);
                    const slotMinutes = slotDate.getHours() * 60 + slotDate.getMinutes();
                    const diff = Math.abs(slotMinutes - prefMinutes);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        selectedSlot = slot;
                    }
                }
            } else if (allSlots.length > 0) {
                selectedSlot = allSlots[0];
            }

            if (!selectedSlot) {
                return NextResponse.json({
                    success: false,
                    error: 'No available slots for the requested date/time',
                    available_dates: Object.keys(slots),
                }, { status: 200 }); // 200 so the AI agent can relay the message
            }

            // Create the appointment
            const dur = duration_minutes || 30;
            const startDate2 = new Date(selectedSlot.startTime);
            const endDate2 = new Date(startDate2);
            endDate2.setMinutes(endDate2.getMinutes() + dur);

            const result = await createAppointment(ghlConfig, {
                calendarId,
                contactId: contact.id,
                startTime: selectedSlot.startTime,
                endTime: endDate2.toISOString(),
                title: `AI Call Booking - ${contact_name || phoneNumber}`,
                status: 'confirmed',
                timezone: tz,
                notes: 'Booked during live AI voice call',
            });

            if (!result.success) {
                return NextResponse.json({
                    success: false,
                    error: result.error || 'Failed to book appointment',
                });
            }

            return NextResponse.json({
                success: true,
                appointment_id: result.appointmentId,
                start_time: selectedSlot.startTime,
                end_time: endDate2.toISOString(),
                contact_id: contact.id,
            });
        }

        // Default: book next available slot
        if (!calendar_id) {
            return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
        }

        const result = await bookNextAvailableAppointment(ghlConfig, {
            phoneNumber,
            calendarId: calendar_id,
            title: `AI Call Booking - ${contact_name || phoneNumber}`,
            timezone: timezone || callRecord.lead_timezone || undefined,
            appointmentDurationMinutes: duration_minutes || 30,
            notes: 'Booked during live AI voice call',
        });

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || 'No available slots',
            });
        }

        return NextResponse.json({
            success: true,
            appointment_id: result.appointmentId,
            contact_id: result.contactId,
            start_time: result.startTime,
        });
    } catch (error) {
        console.error('Live appointment booking error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
