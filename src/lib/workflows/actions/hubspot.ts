/**
 * HubSpot action handlers
 */

import { logCallToHubSpot } from '@/lib/integrations/hubspot';
import type { WorkflowAction } from '@/types';
import type { CallData, ActionHandlerResult, HubspotConfig } from './types';
import { safeParseInt } from '../executor';

function getPhoneNumber(callData: CallData): string | undefined {
    return callData.direction === 'inbound'
        ? callData.from_number
        : callData.to_number;
}

export async function handleHubspotLogCall(
    _action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const result = await logCallToHubSpot(hubspotConfig, {
        phoneNumber,
        direction: callData.direction as 'inbound' | 'outbound',
        durationSeconds: callData.duration_seconds,
        summary: callData.summary,
        transcript: callData.transcript,
        recordingUrl: callData.recording_url,
        sentiment: callData.sentiment,
        agentName: callData.agent_name,
        startedAt: callData.started_at || new Date().toISOString(),
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotCreateContact(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, createContact } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    // Check if contact already exists
    const existingContact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (existingContact) {
        return { success: true }; // Already exists
    }

    const rawConfig = action.config as Record<string, string>;
    const contact = await createContact(hubspotConfig, {
        phone: phoneNumber,
        firstName: rawConfig.first_name || 'Unknown',
        leadStatus: rawConfig.lead_status || 'NEW',
    });

    return contact
        ? { success: true }
        : { success: false, error: 'Failed to create contact' };
}

export async function handleHubspotUpdateContact(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, updateContact } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    // Build properties to update based on config
    const rawConfig = action.config as Record<string, string>;
    const properties: Record<string, string> = {};

    // Update lead status based on sentiment if configured
    if (rawConfig.positive_lead_status && callData.sentiment?.toLowerCase().includes('positive')) {
        properties.hs_lead_status = rawConfig.positive_lead_status;
    } else if (rawConfig.negative_lead_status && callData.sentiment?.toLowerCase().includes('negative')) {
        properties.hs_lead_status = rawConfig.negative_lead_status;
    } else if (rawConfig.default_lead_status) {
        properties.hs_lead_status = rawConfig.default_lead_status;
    }

    // Add custom property if configured
    if (rawConfig.custom_property_name && rawConfig.custom_property_value) {
        properties[rawConfig.custom_property_name] = rawConfig.custom_property_value;
    }

    if (Object.keys(properties).length === 0) {
        return { success: true }; // Nothing to update
    }

    const result = await updateContact(hubspotConfig, contact.id, properties);
    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotAddTags(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, updateContactTags } = await import('@/lib/integrations/hubspot');
    const { calculateAutoTags } = await import('@/lib/integrations/shared');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;
    const parseTagList = (val: string | undefined): string[] =>
        val ? val.split(',').map(t => t.trim()).filter(Boolean) : [];

    const tagsConfig = {
        always_add: parseTagList(rawConfig.always_add),
        sentiment_tags: {
            positive: parseTagList(rawConfig.positive_tags),
            negative: parseTagList(rawConfig.negative_tags),
            neutral: [] as string[],
        },
        duration_tags: {
            short: { max_seconds: 30, tags: parseTagList(rawConfig.short_call_tags) },
            long: { min_seconds: 300, tags: parseTagList(rawConfig.long_call_tags) },
        },
    };

    const tags = calculateAutoTags(
        {
            sentiment: callData.sentiment,
            duration_seconds: callData.duration_seconds,
            transcript: callData.transcript,
        },
        tagsConfig
    );

    const result = await updateContactTags(hubspotConfig, contact.id, tags);
    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotUpdatePipeline(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, updateContactPipeline } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;
    const pipelineId = rawConfig.pipeline_id;

    if (!pipelineId) {
        return { success: false, error: 'Pipeline ID not configured' };
    }

    let targetStageId = rawConfig.default_stage_id;

    if (callData.sentiment?.toLowerCase().includes('positive') && rawConfig.positive_stage_id) {
        targetStageId = rawConfig.positive_stage_id;
    } else if (callData.sentiment?.toLowerCase().includes('negative') && rawConfig.negative_stage_id) {
        targetStageId = rawConfig.negative_stage_id;
    }

    if (!targetStageId) {
        return { success: false, error: 'No matching stage found' };
    }

    const result = await updateContactPipeline(
        hubspotConfig,
        contact.id,
        pipelineId,
        targetStageId,
        `${callData.agent_name || 'AI'} Call Lead`
    );

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotLeadScore(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, updateContactProperty } = await import('@/lib/integrations/hubspot');
    const { calculateLeadScore } = await import('@/lib/integrations/shared');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;

    const scoringRules = {
        positive_sentiment: safeParseInt(rawConfig.positive_sentiment_score, 25),
        negative_sentiment: safeParseInt(rawConfig.negative_sentiment_score, -15),
        long_call: safeParseInt(rawConfig.long_call_score, 20),
        short_call: safeParseInt(rawConfig.short_call_score, -10),
        base_score: safeParseInt(rawConfig.base_score, 50),
    };

    const score = calculateLeadScore(
        {
            sentiment: callData.sentiment,
            duration_seconds: callData.duration_seconds,
            transcript: callData.transcript,
        },
        scoringRules
    );

    const fieldName = rawConfig.property_name || 'ai_lead_score';
    const result = await updateContactProperty(hubspotConfig, contact.id, fieldName, String(score));

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotBookAppointment(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { bookNextAvailableMeeting } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const rawConfig = action.config as Record<string, string>;
    const durationMinutes = safeParseInt(rawConfig.duration_minutes, 30);

    // HubSpot doesn't have a free-slots API, so we create a meeting
    // at a configured time offset from now
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + safeParseInt(rawConfig.days_ahead, 1));
    startTime.setHours(safeParseInt(rawConfig.preferred_hour, 10), 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);

    const result = await bookNextAvailableMeeting(hubspotConfig, {
        phoneNumber,
        title: rawConfig.meeting_title || `${callData.agent_name || 'AI'} Call Follow-up`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: rawConfig.description || `Booked automatically after ${callData.direction} call with ${callData.agent_name || 'AI agent'}`,
        timezone: rawConfig.timezone,
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotCancelAppointment(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const rawConfig = action.config as Record<string, string>;
    const meetingId = rawConfig.meeting_id ||
        (callData.metadata?.meeting_id as string);

    if (!meetingId) {
        return { success: false, error: 'No meeting ID available to cancel' };
    }

    const { cancelMeeting } = await import('@/lib/integrations/hubspot');
    const result = await cancelMeeting(hubspotConfig, meetingId);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotUpsertContact(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { upsertContact } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const rawConfig = action.config as Record<string, string>;

    const tags: string[] = [];
    if (rawConfig.default_tags) {
        tags.push(...rawConfig.default_tags.split(',').map(t => t.trim()).filter(Boolean));
    }
    if (callData.direction === 'inbound') {
        tags.push('inbound-call');
    }
    if (callData.sentiment?.toLowerCase().includes('positive')) {
        tags.push('positive-sentiment');
    } else if (callData.sentiment?.toLowerCase().includes('negative')) {
        tags.push('negative-sentiment');
    }

    const result = await upsertContact(hubspotConfig, phoneNumber, {
        firstName: rawConfig.first_name,
        source: rawConfig.source || 'BuildVoiceAI Call',
        tags: tags.length > 0 ? tags : ['ai-voice-call'],
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotAddCallNote(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, addCallNoteToContact } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;

    const result = await addCallNoteToContact(hubspotConfig, contact.id, {
        direction: callData.direction,
        duration_seconds: callData.duration_seconds,
        agent_name: callData.agent_name,
        summary: callData.summary,
        transcript: callData.transcript,
        recording_url: callData.recording_url,
        sentiment: callData.sentiment,
    }, {
        includeTranscript: rawConfig.include_transcript !== 'false',
        maxTranscriptLength: rawConfig.max_transcript_length
            ? safeParseInt(rawConfig.max_transcript_length, 5000) : undefined,
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotTriggerWorkflow(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, triggerWorkflow } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;
    const workflowId = rawConfig.hubspot_workflow_id;

    if (!workflowId) {
        return { success: false, error: 'HubSpot Workflow ID not configured' };
    }

    const result = await triggerWorkflow(hubspotConfig, contact.id, workflowId);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleHubspotUpdateContactField(
    action: WorkflowAction,
    callData: CallData,
    hubspotConfig?: HubspotConfig,
): Promise<ActionHandlerResult> {
    if (!hubspotConfig?.accessToken) {
        return { success: false, error: 'HubSpot not configured' };
    }

    const { searchContactByPhone, updateContactProperty } = await import('@/lib/integrations/hubspot');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(hubspotConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;
    const propertyName = rawConfig.property_name;
    let propertyValue = rawConfig.value_template || '';

    if (!propertyName) {
        return { success: false, error: 'Property name not configured' };
    }

    // Replace template variables with call data
    const templateVars: Record<string, string> = {
        '{{summary}}': callData.summary || '',
        '{{sentiment}}': callData.sentiment || '',
        '{{duration}}': String(callData.duration_seconds),
        '{{duration_minutes}}': String(Math.round(callData.duration_seconds / 60)),
        '{{agent_name}}': callData.agent_name || '',
        '{{direction}}': callData.direction || '',
        '{{from_number}}': callData.from_number || '',
        '{{to_number}}': callData.to_number || '',
        '{{status}}': callData.status || '',
        '{{call_id}}': callData.call_id || '',
        '{{recording_url}}': callData.recording_url || '',
    };

    for (const [template, value] of Object.entries(templateVars)) {
        propertyValue = propertyValue.replaceAll(template, value);
    }

    const result = await updateContactProperty(hubspotConfig, contact.id, propertyName, propertyValue);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}
