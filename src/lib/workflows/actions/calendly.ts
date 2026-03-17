/**
 * Calendly action handlers
 */

import type { WorkflowAction } from '@/types';
import type { CallData, ActionHandlerResult, CalendlyConfig } from './types';
import { resolveTemplate } from '../executor';

export async function handleCalendlyCheckAvailability(
    action: WorkflowAction,
    _callData: CallData,
    calendlyConfig?: CalendlyConfig,
): Promise<ActionHandlerResult> {
    if (!calendlyConfig?.apiToken || !calendlyConfig?.userUri) {
        return { success: false, error: 'Calendly not connected. Add your API token in Settings.' };
    }

    const { getUserBusyTimes } = await import('@/lib/integrations/calendly');
    const rawConfig = action.config as Record<string, string>;
    const hoursAhead = parseInt(rawConfig.hours_ahead || '48');

    const now = new Date();
    const endTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const busyResult = await getUserBusyTimes(
        { apiToken: calendlyConfig.apiToken },
        calendlyConfig.userUri,
        now.toISOString(),
        endTime.toISOString(),
    );

    if (busyResult.error) {
        return { success: false, error: busyResult.error };
    }

    console.log(`Calendly: ${busyResult.data.length} busy slots in next ${hoursAhead}h`);
    return { success: true };
}

export async function handleCalendlyCreateBookingLink(
    action: WorkflowAction,
    _callData: CallData,
    calendlyConfig?: CalendlyConfig,
): Promise<ActionHandlerResult> {
    if (!calendlyConfig?.apiToken) {
        return { success: false, error: 'Calendly not connected. Add your API token in Settings.' };
    }

    const { createSchedulingLink } = await import('@/lib/integrations/calendly');
    const rawConfig = action.config as Record<string, string>;

    const eventTypeUri = rawConfig.event_type_uri || calendlyConfig.defaultEventTypeUri;
    if (!eventTypeUri) {
        return { success: false, error: 'No Calendly event type configured. Set a default in Settings or specify in action config.' };
    }

    const linkResult = await createSchedulingLink(
        { apiToken: calendlyConfig.apiToken },
        eventTypeUri,
        1, // max 1 booking per link
    );

    if (linkResult.error || !linkResult.data) {
        return { success: false, error: linkResult.error || 'Failed to create scheduling link' };
    }

    console.log(`Calendly booking link created: ${linkResult.data.booking_url}`);
    return { success: true };
}

export async function handleCalendlyCancelEvent(
    action: WorkflowAction,
    callData: CallData,
    calendlyConfig?: CalendlyConfig,
): Promise<ActionHandlerResult> {
    if (!calendlyConfig?.apiToken) {
        return { success: false, error: 'Calendly not connected. Add your API token in Settings.' };
    }

    const { cancelEvent } = await import('@/lib/integrations/calendly');
    const rawConfig = action.config as Record<string, string>;

    const eventUuid = rawConfig.event_uuid ||
        (callData.metadata?.calendly_event_uuid as string);

    if (!eventUuid) {
        return { success: false, error: 'No Calendly event UUID provided' };
    }

    const reason = rawConfig.cancellation_reason
        ? resolveTemplate(rawConfig.cancellation_reason, callData)
        : undefined;

    const cancelResult = await cancelEvent(
        { apiToken: calendlyConfig.apiToken },
        eventUuid,
        reason,
    );

    if (!cancelResult.success) {
        return { success: false, error: cancelResult.error };
    }

    console.log(`Calendly event ${eventUuid} canceled`);
    return { success: true };
}
