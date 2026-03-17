/**
 * GoHighLevel (GHL) action handlers
 */

import { logCallToGHL } from '@/lib/integrations/ghl';
import type { WorkflowAction } from '@/types';
import type { CallData, ActionHandlerResult, GhlConfig } from './types';
import { safeParseInt } from '../executor';

function getPhoneNumber(callData: CallData): string | undefined {
    return callData.direction === 'inbound'
        ? callData.from_number
        : callData.to_number;
}

export async function handleGhlLogCall(
    _action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const result = await logCallToGHL(ghlConfig, {
        phoneNumber,
        direction: callData.direction as 'inbound' | 'outbound',
        durationSeconds: callData.duration_seconds,
        summary: callData.summary,
        transcript: callData.transcript,
        recordingUrl: callData.recording_url,
        sentiment: callData.sentiment,
        agentName: callData.agent_name,
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlCreateContact(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, createContact } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    // Check if contact already exists
    const existingContact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (existingContact) {
        return { success: true }; // Already exists
    }

    const tags = action.config.tags
        ? String(action.config.tags).split(',').map(t => t.trim())
        : ['ai-voice-call'];

    const contact = await createContact(ghlConfig, {
        phone: phoneNumber,
        source: 'BuildVoiceAI Call',
        tags,
    });

    return contact
        ? { success: true }
        : { success: false, error: 'Failed to create contact' };
}

export async function handleGhlAddTags(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, updateContactTags, calculateAutoTags } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    // Find or create contact
    const contact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    // Parse UI config (comma-separated strings) to expected format
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

    // Get existing tags and merge
    const existingTags = contact.tags || [];
    const allTags = [...new Set([...existingTags, ...tags])];

    const result = await updateContactTags(ghlConfig, contact.id, allTags);
    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlUpdatePipeline(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, updateContactPipeline } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    // Parse UI config format
    const rawConfig = action.config as Record<string, string>;
    const pipelineId = rawConfig.pipeline_id;

    if (!pipelineId) {
        return { success: false, error: 'Pipeline ID not configured' };
    }

    // Determine target stage based on sentiment
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
        ghlConfig,
        contact.id,
        pipelineId,
        targetStageId,
        `${callData.agent_name || 'AI'} Call Lead`
    );

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlLeadScore(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, updateContactCustomField, calculateLeadScore } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    // Parse UI config format
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

    const fieldKey = rawConfig.custom_field_key || 'lead_score';
    const result = await updateContactCustomField(ghlConfig, contact.id, fieldKey, score);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlBookAppointment(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { bookNextAvailableAppointment } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    // Parse UI config
    const rawConfig = action.config as Record<string, string>;
    const calendarId = rawConfig.calendar_id;

    if (!calendarId) {
        return { success: false, error: 'Calendar ID not configured' };
    }

    const result = await bookNextAvailableAppointment(ghlConfig, {
        phoneNumber,
        calendarId,
        title: rawConfig.appointment_title || `${callData.agent_name || 'AI'} Call Follow-up`,
        daysAhead: safeParseInt(rawConfig.days_ahead, 7),
        timezone: rawConfig.timezone,
        appointmentDurationMinutes: safeParseInt(rawConfig.duration_minutes, 30),
        notes: rawConfig.notes || `Booked automatically after ${callData.direction} call with ${callData.agent_name || 'AI agent'}`,
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlCancelAppointment(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    // This action is typically used when there's an appointment ID in the call metadata
    // For now, we'll support canceling by appointment ID passed in config or metadata
    const rawConfig = action.config as Record<string, string>;
    const appointmentId = rawConfig.appointment_id ||
        (callData.metadata?.appointment_id as string);

    if (!appointmentId) {
        return { success: false, error: 'No appointment ID available to cancel' };
    }

    const { cancelAppointment } = await import('@/lib/integrations/ghl');
    const result = await cancelAppointment(ghlConfig, appointmentId);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlUpsertContact(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { upsertContact } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const rawConfig = action.config as Record<string, string>;

    // Build tags from config + sentiment-based auto-tags
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

    const result = await upsertContact(ghlConfig, phoneNumber, {
        source: rawConfig.source || 'BuildVoiceAI Call',
        tags: tags.length > 0 ? tags : ['ai-voice-call'],
        customFields: rawConfig.custom_field_key ? [{
            key: rawConfig.custom_field_key,
            value: rawConfig.custom_field_value || callData.summary || '',
        }] : undefined,
    });

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlAddCallNote(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, addCallNoteToContact } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;

    const result = await addCallNoteToContact(ghlConfig, contact.id, {
        direction: callData.direction as 'inbound' | 'outbound',
        durationSeconds: callData.duration_seconds,
        agentName: callData.agent_name,
        summary: callData.summary,
        transcript: callData.transcript,
        recordingUrl: callData.recording_url,
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

export async function handleGhlTriggerWorkflow(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, triggerContactWorkflow } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;
    const workflowId = rawConfig.ghl_workflow_id;

    if (!workflowId) {
        return { success: false, error: 'GHL Workflow ID not configured' };
    }

    const result = await triggerContactWorkflow(ghlConfig, contact.id, workflowId);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}

export async function handleGhlUpdateContactField(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: GhlConfig,
): Promise<ActionHandlerResult> {
    if (!ghlConfig?.apiKey) {
        return { success: false, error: 'GoHighLevel not configured' };
    }

    const { searchContactByPhone, updateContactCustomField } = await import('@/lib/integrations/ghl');

    const phoneNumber = getPhoneNumber(callData);
    if (!phoneNumber) {
        return { success: false, error: 'No phone number available' };
    }

    const contact = await searchContactByPhone(ghlConfig, phoneNumber);
    if (!contact) {
        return { success: false, error: 'Contact not found' };
    }

    const rawConfig = action.config as Record<string, string>;
    const fieldKey = rawConfig.field_key;
    let fieldValue = rawConfig.value_template || '';

    if (!fieldKey) {
        return { success: false, error: 'Field key not configured' };
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
        fieldValue = fieldValue.replaceAll(template, value);
    }

    const result = await updateContactCustomField(ghlConfig, contact.id, fieldKey, fieldValue);

    return result.success
        ? { success: true }
        : { success: false, error: result.error };
}
