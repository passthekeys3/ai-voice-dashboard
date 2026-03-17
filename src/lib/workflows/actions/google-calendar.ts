/**
 * Google Calendar action handlers
 */

import type { WorkflowAction } from '@/types';
import type { CallData, ActionHandlerResult, GcalConfig } from './types';
import { safeParseInt } from '../executor';

export async function handleGcalBookEvent(
    action: WorkflowAction,
    callData: CallData,
    gcalConfig?: GcalConfig,
): Promise<ActionHandlerResult> {
    if (!gcalConfig?.accessToken) {
        return { success: false, error: 'Google Calendar not configured' };
    }

    const { bookEventWithAvailabilityCheck } = await import('@/lib/integrations/gcal');
    const rawConfig = action.config as Record<string, string>;
    const calendarId = rawConfig.calendar_id || gcalConfig.calendarId;

    if (!calendarId) {
        return { success: false, error: 'Calendar ID not configured' };
    }

    const phoneNumber = callData.direction === 'inbound'
        ? callData.from_number
        : callData.to_number;

    const result = await bookEventWithAvailabilityCheck(
        { accessToken: gcalConfig.accessToken },
        {
            calendarId,
            summary: rawConfig.event_title || `${callData.agent_name || 'AI'} Call Follow-up`,
            description: rawConfig.description || `Booked after ${callData.direction} call with ${callData.agent_name || 'AI agent'}. Contact: ${phoneNumber || 'unknown'}`,
            durationMinutes: safeParseInt(rawConfig.duration_minutes, 30),
            daysAhead: safeParseInt(rawConfig.days_ahead, 7),
            startHour: safeParseInt(rawConfig.start_hour, 9),
            endHour: safeParseInt(rawConfig.end_hour, 17),
            timezone: rawConfig.timezone,
            attendeeEmail: rawConfig.attendee_email,
        }
    );

    return result.success
        ? { success: true }
        : { success: false, error: result.error || 'Failed to book calendar event' };
}

export async function handleGcalCancelEvent(
    action: WorkflowAction,
    callData: CallData,
    gcalConfig?: GcalConfig,
): Promise<ActionHandlerResult> {
    if (!gcalConfig?.accessToken) {
        return { success: false, error: 'Google Calendar not configured' };
    }

    const { cancelEvent } = await import('@/lib/integrations/gcal');
    const rawConfig = action.config as Record<string, string>;
    const eventId = rawConfig.event_id || (callData.metadata?.gcal_event_id as string);
    const calendarId = rawConfig.calendar_id || gcalConfig.calendarId;

    if (!eventId) {
        return { success: false, error: 'No event ID available to cancel' };
    }
    if (!calendarId) {
        return { success: false, error: 'Calendar ID not configured' };
    }

    const result = await cancelEvent(
        { accessToken: gcalConfig.accessToken },
        calendarId,
        eventId
    );

    return result.success
        ? { success: true }
        : { success: false, error: result.error || 'Failed to cancel calendar event' };
}

export async function handleGcalCheckAvailability(
    action: WorkflowAction,
    _callData: CallData,
    gcalConfig?: GcalConfig,
): Promise<ActionHandlerResult> {
    if (!gcalConfig?.accessToken) {
        return { success: false, error: 'Google Calendar not configured' };
    }

    const { getFreeBusy } = await import('@/lib/integrations/gcal');
    const rawConfig = action.config as Record<string, string>;
    const calendarId = rawConfig.calendar_id || gcalConfig.calendarId;

    if (!calendarId) {
        return { success: false, error: 'Calendar ID not configured' };
    }

    const hoursAhead = safeParseInt(rawConfig.hours_ahead, 24);
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();

    const busySlots = await getFreeBusy(
        { accessToken: gcalConfig.accessToken },
        {
            calendarIds: [calendarId],
            timeMin,
            timeMax,
            timeZone: rawConfig.timezone,
        }
    );

    const slotCount = busySlots[calendarId]?.length || 0;
    console.log(`GCal availability check: ${slotCount} busy slots in next ${hoursAhead}h`);

    return { success: true };
}
