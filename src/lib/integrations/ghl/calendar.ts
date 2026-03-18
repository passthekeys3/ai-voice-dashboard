/**
 * GHL Calendar & Appointment operations.
 */

import { type GHLConfig, ghlFetch } from './shared';
import { searchContactByPhone, createContact } from './contacts';

// ── Types ────────────────────────────────────────────────

export interface GHLCalendar {
    id: string;
    name: string;
    description?: string;
    locationId: string;
    teamMembers?: { userId: string; priority?: number }[];
}

export interface GHLTimeSlot {
    startTime: string;
    endTime: string;
}

export interface GHLAppointment {
    id: string;
    calendarId: string;
    contactId: string;
    title?: string;
    startTime: string;
    endTime: string;
    status: 'confirmed' | 'showed' | 'noshow' | 'cancelled' | 'invalid' | 'new';
    assignedUserId?: string;
    address?: string;
    notes?: string;
}

// ── Functions ────────────────────────────────────────────

/** Get all calendars for a location */
export async function getCalendars(config: GHLConfig): Promise<GHLCalendar[]> {
    const data = await ghlFetch<{ calendars: GHLCalendar[] }>(config, '/calendars/', {
        params: { locationId: config.locationId },
    });
    return data?.calendars || [];
}

/** Get free slots for a calendar between a date range */
export async function getCalendarFreeSlots(
    config: GHLConfig,
    calendarId: string,
    startDate: Date,
    endDate: Date,
    timezone?: string,
): Promise<Record<string, GHLTimeSlot[]>> {
    const params: Record<string, string> = {
        startDate: String(startDate.getTime()),
        endDate: String(endDate.getTime()),
    };
    if (timezone) params.timezone = timezone;

    const data = await ghlFetch<Record<string, GHLTimeSlot[]>>(config, `/calendars/${calendarId}/free-slots`, { params });
    return data || {};
}

/** Get the next available slot from a calendar */
export async function getNextAvailableSlot(
    config: GHLConfig,
    calendarId: string,
    daysAhead: number = 7,
    timezone?: string,
): Promise<GHLTimeSlot | null> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const slots = await getCalendarFreeSlots(config, calendarId, startDate, endDate, timezone);
    const sortedDates = Object.keys(slots).sort();
    for (const date of sortedDates) {
        if (slots[date]?.length > 0) return slots[date][0];
    }
    return null;
}

/** Create an appointment */
export async function createAppointment(
    config: GHLConfig,
    appointment: {
        calendarId: string;
        contactId: string;
        startTime: string;
        endTime?: string;
        title?: string;
        status?: 'confirmed' | 'new';
        assignedUserId?: string;
        address?: string;
        notes?: string;
        timezone?: string;
        toNotify?: boolean;
    },
): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    // Default end time: 30 minutes after start
    let endTime = appointment.endTime;
    if (!endTime) {
        const start = new Date(appointment.startTime);
        start.setMinutes(start.getMinutes() + 30);
        endTime = start.toISOString();
    }

    const data = await ghlFetch<{ id?: string; appointment?: { id: string } }>(config, '/calendars/events/appointments', {
        method: 'POST',
        calendar: true,
        body: {
            calendarId: appointment.calendarId,
            locationId: config.locationId,
            contactId: appointment.contactId,
            startTime: appointment.startTime,
            endTime,
            title: appointment.title || 'AI Voice Call Follow-up',
            appointmentStatus: appointment.status || 'new',
            assignedUserId: appointment.assignedUserId,
            address: appointment.address,
            toNotify: appointment.toNotify !== false,
        },
    });

    return data
        ? { success: true, appointmentId: data.id || data.appointment?.id }
        : { success: false, error: 'Failed to create appointment' };
}

/** Update an existing appointment */
export async function updateAppointment(
    config: GHLConfig,
    appointmentId: string,
    updates: {
        startTime?: string;
        endTime?: string;
        title?: string;
        status?: 'confirmed' | 'showed' | 'noshow' | 'cancelled' | 'invalid' | 'new';
        assignedUserId?: string;
        address?: string;
    },
): Promise<{ success: boolean; error?: string }> {
    const result = await ghlFetch(config, `/calendars/events/appointments/${appointmentId}`, {
        method: 'PUT',
        calendar: true,
        body: updates as Record<string, unknown>,
    });
    return result ? { success: true } : { success: false, error: 'Failed to update appointment' };
}

/** Cancel an appointment */
export async function cancelAppointment(
    config: GHLConfig,
    appointmentId: string,
): Promise<{ success: boolean; error?: string }> {
    return updateAppointment(config, appointmentId, { status: 'cancelled' });
}

/** Get an appointment by ID */
export async function getAppointment(
    config: GHLConfig,
    appointmentId: string,
): Promise<GHLAppointment | null> {
    return ghlFetch<GHLAppointment>(config, `/calendars/events/appointments/${appointmentId}`, { calendar: true });
}

/** Book an appointment using the next available slot (high-level helper) */
export async function bookNextAvailableAppointment(
    config: GHLConfig,
    params: {
        phoneNumber: string;
        calendarId: string;
        title?: string;
        daysAhead?: number;
        timezone?: string;
        appointmentDurationMinutes?: number;
        notes?: string;
    },
): Promise<{ success: boolean; appointmentId?: string; contactId?: string; startTime?: string; error?: string }> {
    try {
        let contact = await searchContactByPhone(config, params.phoneNumber);
        if (!contact) {
            contact = await createContact(config, {
                phone: params.phoneNumber,
                source: 'BuildVoiceAI Call',
                tags: ['ai-voice-call', 'appointment-booked'],
            });
        }
        if (!contact) return { success: false, error: 'Failed to find or create contact' };

        const nextSlot = await getNextAvailableSlot(config, params.calendarId, params.daysAhead || 7, params.timezone);
        if (!nextSlot) return { success: false, contactId: contact.id, error: 'No available slots found' };

        const duration = params.appointmentDurationMinutes || 30;
        const endDate = new Date(nextSlot.startTime);
        endDate.setMinutes(endDate.getMinutes() + duration);

        const result = await createAppointment(config, {
            calendarId: params.calendarId,
            contactId: contact.id,
            startTime: nextSlot.startTime,
            endTime: endDate.toISOString(),
            title: params.title || 'AI Voice Call Follow-up',
            status: 'confirmed',
            timezone: params.timezone,
            notes: params.notes,
        });

        return result.success
            ? { success: true, appointmentId: result.appointmentId, contactId: contact.id, startTime: nextSlot.startTime }
            : { success: false, contactId: contact.id, error: 'Failed to book appointment' };
    } catch (error) {
        console.error('GHL bookNextAvailableAppointment error:', error instanceof Error ? error.message : 'Unknown error');
        return { success: false, error: 'Failed to book appointment' };
    }
}
