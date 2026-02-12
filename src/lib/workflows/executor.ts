/**
 * Workflow Execution Engine
 * 
 * Executes workflow actions based on call events
 */

import { logCallToGHL } from '@/lib/integrations/ghl';
import { logCallToHubSpot } from '@/lib/integrations/hubspot';
import { logWarning } from '@/lib/error-logger';
import type { Workflow, WorkflowAction, WorkflowCondition, ActionResult } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Safely parse an integer from config, returning a default if value is missing or non-numeric
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === '') return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

interface ExecutionOptions {
    supabase?: SupabaseClient;
    agencyId?: string;
}

interface CallData {
    call_id: string;
    agent_id: string;
    agent_name?: string;
    status: string;
    direction: string;
    duration_seconds: number;
    cost_cents: number;
    from_number?: string;
    to_number?: string;
    transcript?: string;
    recording_url?: string;
    summary?: string;
    sentiment?: string;
    started_at?: string;
    ended_at?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown; // Index signature for dynamic field access
}

/**
 * Resolve template variables in a string (e.g., {{from_number}}, {{summary}})
 */
function resolveTemplate(template: string, callData: CallData): string {
    const vars: Record<string, string> = {
        '{{call_id}}': callData.call_id || '',
        '{{agent_name}}': callData.agent_name || '',
        '{{status}}': callData.status || '',
        '{{direction}}': callData.direction || '',
        '{{duration}}': String(callData.duration_seconds || 0),
        '{{duration_minutes}}': String(Math.round((callData.duration_seconds || 0) / 60)),
        '{{from_number}}': callData.from_number || '',
        '{{to_number}}': callData.to_number || '',
        '{{summary}}': callData.summary || '',
        '{{sentiment}}': callData.sentiment || '',
        '{{recording_url}}': callData.recording_url || '',
    };
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replaceAll(key, value);
    }
    return result;
}

interface ExecutionResult {
    workflow_id: string;
    workflow_name: string;
    actions_executed: number;
    actions_failed: number;
    errors: string[];
}

/**
 * Check if a workflow's conditions are met
 */
function evaluateConditions(conditions: WorkflowCondition[], callData: CallData): boolean {
    if (!conditions || conditions.length === 0) {
        return true; // No conditions = always run
    }

    return conditions.every((condition) => {
        const value = (callData as Record<string, unknown>)[condition.field];

        switch (condition.operator) {
            case '==':
                return value === condition.value;
            case '!=':
                return value !== condition.value;
            case '>':
            case '<':
            case '>=':
            case '<=': {
                if (value == null) return false;
                const numValue = Number(value);
                const numCondition = Number(condition.value);
                if (isNaN(numValue) || isNaN(numCondition)) return false;
                if (condition.operator === '>') return numValue > numCondition;
                if (condition.operator === '<') return numValue < numCondition;
                if (condition.operator === '>=') return numValue >= numCondition;
                return numValue <= numCondition;
            }
            case 'contains':
                if (value == null) return false;
                return String(value).includes(String(condition.value));
            case 'not_contains':
                if (value == null) return true;
                return !String(value).includes(String(condition.value));
            default:
                return false;
        }
    });
}

/**
 * Determine if an error is retryable (network/server errors, not client errors)
 */
function isRetryableError(error: string): boolean {
    const retryablePatterns = [
        'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
        'fetch failed', 'network error', 'request timeout',
        'status 500', 'status 502', 'status 503', 'status 504', 'status 429',
        'returned 500', 'returned 502', 'returned 503', 'returned 504', 'returned 429',
    ];
    const lowerError = error.toLowerCase();
    return retryablePatterns.some(pattern => lowerError.includes(pattern.toLowerCase()));
}

/**
 * Execute an action with retry logic for transient failures
 */
async function executeActionWithRetry(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: { apiKey: string; locationId: string },
    hubspotConfig?: { accessToken: string },
    gcalConfig?: { accessToken: string; calendarId: string },
    calendlyConfig?: { apiToken: string; userUri: string; defaultEventTypeUri?: string },
    maxRetries: number = 2,
    baseDelayMs: number = 1000
): Promise<{ success: boolean; error?: string; attempts: number }> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await executeAction(action, callData, ghlConfig, hubspotConfig, gcalConfig, calendlyConfig);

        if (result.success) {
            return { success: true, attempts: attempt + 1 };
        }

        lastError = result.error;

        // Don't retry non-retryable errors
        if (!lastError || !isRetryableError(lastError)) {
            return { success: false, error: lastError, attempts: attempt + 1 };
        }

        // Don't delay after last attempt
        if (attempt < maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return { success: false, error: `${lastError} (after ${maxRetries + 1} attempts)`, attempts: maxRetries + 1 };
}

/**
 * Execute a single workflow action
 */
async function executeAction(
    action: WorkflowAction,
    callData: CallData,
    ghlConfig?: { apiKey: string; locationId: string },
    hubspotConfig?: { accessToken: string },
    gcalConfig?: { accessToken: string; calendarId: string },
    calendlyConfig?: { apiToken: string; userUri: string; defaultEventTypeUri?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        switch (action.type) {
            case 'webhook': {
                const url = action.config.url as string;
                if (!url) {
                    return { success: false, error: 'Webhook URL not configured' };
                }

                // Validate URL
                let parsedUrl: URL;
                try {
                    parsedUrl = new URL(url);
                } catch {
                    return { success: false, error: 'Invalid webhook URL' };
                }

                // Enforce HTTPS in production
                if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
                    return { success: false, error: 'Webhook URL must use HTTPS in production' };
                }
                if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
                    return { success: false, error: 'Webhook URL must use HTTP or HTTPS' };
                }

                // Block internal/private IPs
                const hostname = parsedUrl.hostname.toLowerCase();
                const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'];
                if (blockedHosts.includes(hostname)) {
                    return { success: false, error: 'Webhook URL cannot target internal hosts' };
                }
                const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
                if (ipMatch) {
                    const [, a, b] = ipMatch.map(Number);
                    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
                    if (a === 10 || (a === 172 && b >= 16 && b <= 31) ||
                        (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) {
                        return { success: false, error: 'Webhook URL cannot target private IP ranges' };
                    }
                }

                // Filter dangerous headers
                const BLOCKED_HEADERS = ['authorization', 'cookie', 'x-forwarded-for',
                    'x-forwarded-host', 'x-forwarded-proto', 'host', 'x-real-ip'];
                const rawHeaders = (action.config.headers as Record<string, string>) || {};
                const safeHeaders: Record<string, string> = {};
                for (const [key, value] of Object.entries(rawHeaders)) {
                    if (!BLOCKED_HEADERS.includes(key.toLowerCase())) {
                        safeHeaders[key] = value;
                    }
                }

                // Infer event from call status/direction rather than hardcoding
                const event = callData.status === 'in_progress' || callData.status === 'queued'
                    ? (callData.direction === 'inbound' ? 'inbound_call_started' : 'call_started')
                    : (callData.direction === 'inbound' ? 'inbound_call_ended' : 'call_ended');

                // Add timeout via AbortController
                const webhookController = new AbortController();
                const timeoutId = setTimeout(() => webhookController.abort(), 15_000);

                try {
                    const response = await fetch(url, {
                        method: (action.config.method as string) || 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...safeHeaders,
                        },
                        body: JSON.stringify({
                            event,
                            ...callData,
                        }),
                        signal: webhookController.signal,
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        return { success: false, error: `Webhook returned ${response.status}` };
                    }

                    return { success: true };
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                        return { success: false, error: 'Webhook request timed out' };
                    }
                    throw fetchError;
                }
            }

            case 'ghl_log_call': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_create_contact': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                // Import and use createContact from ghl module
                const { searchContactByPhone, createContact } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_add_tags': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { searchContactByPhone, updateContactTags, calculateAutoTags } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_update_pipeline': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { searchContactByPhone, updateContactPipeline } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_lead_score': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { searchContactByPhone, updateContactCustomField, calculateLeadScore } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_book_appointment': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { bookNextAvailableAppointment } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_cancel_appointment': {
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

            // ======================================
            // Inbound Receptionist GHL Actions
            // ======================================

            case 'ghl_upsert_contact': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { upsertContact } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_add_call_note': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { searchContactByPhone, addCallNoteToContact } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_trigger_workflow': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { searchContactByPhone, triggerContactWorkflow } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'ghl_update_contact_field': {
                if (!ghlConfig?.apiKey) {
                    return { success: false, error: 'GoHighLevel not configured' };
                }

                const { searchContactByPhone, updateContactCustomField } = await import('@/lib/integrations/ghl');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            // HubSpot Actions
            case 'hubspot_log_call': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_create_contact': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, createContact } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_update_contact': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, updateContact } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_add_tags': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, updateContactTags } = await import('@/lib/integrations/hubspot');
                const { calculateAutoTags } = await import('@/lib/integrations/shared');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_update_pipeline': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, updateContactPipeline } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_lead_score': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, updateContactProperty } = await import('@/lib/integrations/hubspot');
                const { calculateLeadScore } = await import('@/lib/integrations/shared');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_book_appointment': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { bookNextAvailableMeeting } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_cancel_appointment': {
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

            case 'hubspot_upsert_contact': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { upsertContact } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_add_call_note': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, addCallNoteToContact } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_trigger_workflow': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, triggerWorkflow } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            case 'hubspot_update_contact_field': {
                if (!hubspotConfig?.accessToken) {
                    return { success: false, error: 'HubSpot not configured' };
                }

                const { searchContactByPhone, updateContactProperty } = await import('@/lib/integrations/hubspot');

                const phoneNumber = callData.direction === 'inbound'
                    ? callData.from_number
                    : callData.to_number;

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

            // --- Google Calendar Actions ---

            case 'gcal_book_event': {
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

            case 'gcal_cancel_event': {
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

            case 'gcal_check_availability': {
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

            // ========================================
            // Messaging Actions
            // ========================================

            case 'send_sms': {
                const rawConfig = action.config as Record<string, string>;
                const to = resolveTemplate(rawConfig.to || '{{from_number}}', callData);
                const message = resolveTemplate(rawConfig.message || '', callData);

                if (!to || !message) {
                    return { success: false, error: 'SMS recipient or message not configured' };
                }

                // Validate phone number format (E.164-like)
                if (!to.match(/^\+?[1-9]\d{1,14}$/)) {
                    return { success: false, error: `Invalid phone number format: ${to}` };
                }

                const accountSid = process.env.TWILIO_ACCOUNT_SID;
                const authToken = process.env.TWILIO_AUTH_TOKEN;
                const fromNumber = process.env.TWILIO_PHONE_NUMBER;

                if (!accountSid || !authToken || !fromNumber) {
                    return { success: false, error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' };
                }

                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
                const smsResponse = await fetch(twilioUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        To: to,
                        From: fromNumber,
                        Body: message.substring(0, 1600), // SMS body limit
                    }),
                });

                if (!smsResponse.ok) {
                    const errorText = await smsResponse.text();
                    console.error('Twilio SMS error:', errorText);
                    return { success: false, error: `SMS send failed: ${smsResponse.status}` };
                }

                console.log(`SMS sent to ${to}`);
                return { success: true };
            }

            case 'send_email': {
                const rawConfig = action.config as Record<string, string>;
                const to = resolveTemplate(rawConfig.to || '', callData);
                const subject = resolveTemplate(rawConfig.subject || '', callData);
                const body = resolveTemplate(rawConfig.body || '', callData);

                if (!to || !subject) {
                    return { success: false, error: 'Email recipient or subject not configured' };
                }

                const resendApiKey = process.env.RESEND_API_KEY;
                const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@buildvoiceai.com';

                if (!resendApiKey) {
                    return { success: false, error: 'Resend not configured. Set RESEND_API_KEY.' };
                }

                const emailResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: fromEmail,
                        to: [to],
                        subject,
                        html: body || `<p>${subject}</p>`,
                    }),
                });

                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text();
                    console.error('Resend email error:', errorText);
                    return { success: false, error: `Email send failed: ${emailResponse.status}` };
                }

                console.log(`Email sent to ${to}`);
                return { success: true };
            }

            // ================================================================
            // Slack notifications
            // ================================================================

            case 'send_slack': {
                const { sendSlackMessage, buildCallNotificationBlocks, isValidSlackWebhookUrl } = await import('@/lib/integrations/slack');
                const rawConfig = action.config as Record<string, string>;

                // Webhook URL from action config or agency default (passed via metadata)
                const webhookUrl = rawConfig.webhook_url ||
                    (callData.metadata?.slack_webhook_url as string);

                if (!webhookUrl) {
                    return { success: false, error: 'Slack webhook URL not configured. Set it in Settings or in the action config.' };
                }

                if (!isValidSlackWebhookUrl(webhookUrl)) {
                    return { success: false, error: 'Invalid Slack webhook URL' };
                }

                const messageTemplate = rawConfig.message_template
                    ? resolveTemplate(rawConfig.message_template, callData)
                    : undefined;

                const payload = buildCallNotificationBlocks({
                    call_id: callData.call_id,
                    agent_name: callData.agent_name,
                    status: callData.status,
                    direction: callData.direction,
                    duration_seconds: callData.duration_seconds,
                    from_number: callData.from_number,
                    to_number: callData.to_number,
                    summary: callData.summary,
                    sentiment: callData.sentiment,
                    recording_url: callData.recording_url,
                }, messageTemplate);

                const slackResult = await sendSlackMessage(webhookUrl, payload);
                if (!slackResult.success) {
                    return { success: false, error: slackResult.error };
                }

                console.log(`Slack notification sent for call ${callData.call_id}`);
                return { success: true };
            }

            // ================================================================
            // Calendly integrations
            // ================================================================

            case 'calendly_check_availability': {
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

            case 'calendly_create_booking_link': {
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

            case 'calendly_cancel_event': {
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

            default:
                return { success: false, error: `Unknown action type: ${action.type}` };
        }
    } catch (err) {
        return { success: false, error: String(err) };
    }
}

/**
 * Execute all matching workflows for a call event
 */
export async function executeWorkflows(
    workflows: Workflow[],
    callData: CallData,
    ghlConfig?: { apiKey: string; locationId: string },
    hubspotConfig?: { accessToken: string },
    gcalConfig?: { accessToken: string; calendarId: string },
    calendlyConfig?: { apiToken: string; userUri: string; defaultEventTypeUri?: string },
    options?: ExecutionOptions
): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const { supabase, agencyId } = options || {};

    for (const workflow of workflows) {
        if (!workflow.is_active) continue;

        const workflowStartTime = Date.now();
        let logId: string | null = null;

        // Check conditions
        if (!evaluateConditions(workflow.conditions, callData)) {
            console.log(`Workflow "${workflow.name}" conditions not met, skipping`);

            // Log skipped execution
            if (supabase && agencyId) {
                try {
                    await supabase.from('workflow_execution_log').insert({
                        agency_id: agencyId,
                        workflow_id: workflow.id,
                        call_id: callData.call_id,
                        trigger: workflow.trigger || 'call_ended',
                        status: 'skipped',
                        started_at: new Date().toISOString(),
                        completed_at: new Date().toISOString(),
                        duration_ms: 0,
                        actions_total: workflow.actions.length,
                        actions_succeeded: 0,
                        actions_failed: 0,
                        action_results: [],
                    });
                } catch (e) {
                    console.error('Failed to log skipped workflow execution:', e);
                }
            }

            continue;
        }

        // Insert initial "running" log entry
        if (supabase && agencyId) {
            try {
                const { data } = await supabase.from('workflow_execution_log').insert({
                    agency_id: agencyId,
                    workflow_id: workflow.id,
                    call_id: callData.call_id,
                    trigger: workflow.trigger || 'call_ended',
                    status: 'running',
                    actions_total: workflow.actions.length,
                }).select('id').single();
                logId = data?.id || null;
            } catch (e) {
                console.error('Failed to create workflow execution log:', e);
            }
        }

        const result: ExecutionResult = {
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            actions_executed: 0,
            actions_failed: 0,
            errors: [],
        };

        const actionResults: ActionResult[] = [];

        // Execute each action
        for (let i = 0; i < workflow.actions.length; i++) {
            const action = workflow.actions[i];
            const actionStartTime = Date.now();
            const actionStartedAt = new Date().toISOString();

            const actionResult = await executeActionWithRetry(action, callData, ghlConfig, hubspotConfig, gcalConfig, calendlyConfig);

            const actionEndTime = Date.now();

            actionResults.push({
                action_index: i,
                action_type: action.type,
                status: actionResult.success ? 'success' : 'failed',
                started_at: actionStartedAt,
                completed_at: new Date().toISOString(),
                duration_ms: actionEndTime - actionStartTime,
                error: actionResult.error || undefined,
                attempts: actionResult.attempts || 1,
            });

            if (actionResult.success) {
                result.actions_executed++;
            } else {
                result.actions_failed++;
                if (actionResult.error) {
                    result.errors.push(`${action.type}: ${actionResult.error}`);
                }
            }
        }

        const workflowDuration = Date.now() - workflowStartTime;

        // Determine final status
        let finalStatus: 'completed' | 'partial_failure' | 'failed';
        if (result.actions_failed === 0) {
            finalStatus = 'completed';
        } else if (result.actions_executed === 0) {
            finalStatus = 'failed';
        } else {
            finalStatus = 'partial_failure';
        }

        // Update execution log with results
        if (supabase && logId) {
            try {
                await supabase.from('workflow_execution_log').update({
                    status: finalStatus,
                    completed_at: new Date().toISOString(),
                    duration_ms: workflowDuration,
                    actions_succeeded: result.actions_executed,
                    actions_failed: result.actions_failed,
                    action_results: actionResults,
                    error_summary: result.errors.length > 0 ? result.errors.join('; ') : null,
                }).eq('id', logId);
            } catch (e) {
                console.error('Failed to update workflow execution log:', e);
            }
        }

        // Log warnings for failed actions via error logger (Sentry integration)
        if (result.actions_failed > 0) {
            logWarning(`Workflow "${workflow.name}" had ${result.actions_failed} failed action(s)`, {
                workflow_id: workflow.id,
                call_id: callData.call_id,
                errors: result.errors,
                agency_id: agencyId,
            });
        }

        console.log(`Workflow "${workflow.name}" executed: ${result.actions_executed} success, ${result.actions_failed} failed (${workflowDuration}ms)`);
        results.push(result);
    }

    return results;
}
