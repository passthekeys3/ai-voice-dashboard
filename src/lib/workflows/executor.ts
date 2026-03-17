/**
 * Workflow Execution Engine
 *
 * Executes workflow actions based on call events
 */

import { logWarning } from '@/lib/error-logger';
import type { Workflow, WorkflowAction, WorkflowCondition, ActionResult } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Action handlers
import { handleWebhook } from './actions/webhook';
import {
    handleGhlLogCall, handleGhlCreateContact, handleGhlAddTags,
    handleGhlUpdatePipeline, handleGhlLeadScore, handleGhlBookAppointment,
    handleGhlCancelAppointment, handleGhlUpsertContact, handleGhlAddCallNote,
    handleGhlTriggerWorkflow, handleGhlUpdateContactField,
} from './actions/ghl';
import {
    handleHubspotLogCall, handleHubspotCreateContact, handleHubspotUpdateContact,
    handleHubspotAddTags, handleHubspotUpdatePipeline, handleHubspotLeadScore,
    handleHubspotBookAppointment, handleHubspotCancelAppointment,
    handleHubspotUpsertContact, handleHubspotAddCallNote,
    handleHubspotTriggerWorkflow, handleHubspotUpdateContactField,
} from './actions/hubspot';
import {
    handleGcalBookEvent, handleGcalCancelEvent, handleGcalCheckAvailability,
} from './actions/google-calendar';
import {
    handleSendSms, handleSendEmail, handleSendSlack,
} from './actions/communication';
import {
    handleCalendlyCheckAvailability, handleCalendlyCreateBookingLink,
    handleCalendlyCancelEvent,
} from './actions/calendly';

/**
 * Safely parse an integer from config, returning a default if value is missing or non-numeric
 */
export function safeParseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === '') return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

export const EXTERNAL_API_TIMEOUT = 15_000;

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
 * HTML-escape a string to prevent injection when used in email HTML bodies
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Resolve template variables in a string (e.g., {{from_number}}, {{summary}})
 */
export function resolveTemplate(template: string, callData: CallData): string {
    const vars: Record<string, string> = {
        '{{call_id}}': callData.call_id || '',
        '{{agent_name}}': callData.agent_name || '',
        '{{status}}': callData.status || '',
        '{{direction}}': callData.direction || '',
        '{{duration}}': String(callData.duration_seconds || 0),
        '{{duration_seconds}}': String(callData.duration_seconds || 0),
        '{{duration_minutes}}': String(Math.round((callData.duration_seconds || 0) / 60)),
        '{{from_number}}': callData.from_number || '',
        '{{to_number}}': callData.to_number || '',
        '{{summary}}': callData.summary || '',
        '{{sentiment}}': callData.sentiment || '',
        '{{recording_url}}': callData.recording_url || '',
        '{{transcript}}': callData.transcript || '',
        '{{started_at}}': callData.started_at || '',
        '{{ended_at}}': callData.ended_at || '',
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
export function evaluateConditions(conditions: WorkflowCondition[], callData: CallData): boolean {
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
export function isRetryableError(error: string): boolean {
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
            case 'webhook':
                return await handleWebhook(action, callData);

            case 'ghl_log_call':
                return await handleGhlLogCall(action, callData, ghlConfig);

            case 'ghl_create_contact':
                return await handleGhlCreateContact(action, callData, ghlConfig);

            case 'ghl_add_tags':
                return await handleGhlAddTags(action, callData, ghlConfig);

            case 'ghl_update_pipeline':
                return await handleGhlUpdatePipeline(action, callData, ghlConfig);

            case 'ghl_lead_score':
                return await handleGhlLeadScore(action, callData, ghlConfig);

            case 'ghl_book_appointment':
                return await handleGhlBookAppointment(action, callData, ghlConfig);

            case 'ghl_cancel_appointment':
                return await handleGhlCancelAppointment(action, callData, ghlConfig);

            case 'ghl_upsert_contact':
                return await handleGhlUpsertContact(action, callData, ghlConfig);

            case 'ghl_add_call_note':
                return await handleGhlAddCallNote(action, callData, ghlConfig);

            case 'ghl_trigger_workflow':
                return await handleGhlTriggerWorkflow(action, callData, ghlConfig);

            case 'ghl_update_contact_field':
                return await handleGhlUpdateContactField(action, callData, ghlConfig);

            // HubSpot Actions
            case 'hubspot_log_call':
                return await handleHubspotLogCall(action, callData, hubspotConfig);

            case 'hubspot_create_contact':
                return await handleHubspotCreateContact(action, callData, hubspotConfig);

            case 'hubspot_update_contact':
                return await handleHubspotUpdateContact(action, callData, hubspotConfig);

            case 'hubspot_add_tags':
                return await handleHubspotAddTags(action, callData, hubspotConfig);

            case 'hubspot_update_pipeline':
                return await handleHubspotUpdatePipeline(action, callData, hubspotConfig);

            case 'hubspot_lead_score':
                return await handleHubspotLeadScore(action, callData, hubspotConfig);

            case 'hubspot_book_appointment':
                return await handleHubspotBookAppointment(action, callData, hubspotConfig);

            case 'hubspot_cancel_appointment':
                return await handleHubspotCancelAppointment(action, callData, hubspotConfig);

            case 'hubspot_upsert_contact':
                return await handleHubspotUpsertContact(action, callData, hubspotConfig);

            case 'hubspot_add_call_note':
                return await handleHubspotAddCallNote(action, callData, hubspotConfig);

            case 'hubspot_trigger_workflow':
                return await handleHubspotTriggerWorkflow(action, callData, hubspotConfig);

            case 'hubspot_update_contact_field':
                return await handleHubspotUpdateContactField(action, callData, hubspotConfig);

            // Google Calendar Actions
            case 'gcal_book_event':
                return await handleGcalBookEvent(action, callData, gcalConfig);

            case 'gcal_cancel_event':
                return await handleGcalCancelEvent(action, callData, gcalConfig);

            case 'gcal_check_availability':
                return await handleGcalCheckAvailability(action, callData, gcalConfig);

            // Messaging Actions
            case 'send_sms':
                return await handleSendSms(action, callData);

            case 'send_email':
                return await handleSendEmail(action, callData);

            case 'send_slack':
                return await handleSendSlack(action, callData);

            // Calendly Actions
            case 'calendly_check_availability':
                return await handleCalendlyCheckAvailability(action, callData, calendlyConfig);

            case 'calendly_create_booking_link':
                return await handleCalendlyCreateBookingLink(action, callData, calendlyConfig);

            case 'calendly_cancel_event':
                return await handleCalendlyCancelEvent(action, callData, calendlyConfig);

            default:
                return { success: false, error: `Unknown action type: ${action.type}` };
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof Error && err.stack) {
            console.error(`Workflow action error [${action.type}]:`, err.stack);
        }
        return { success: false, error: message };
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
                    console.error('Failed to log skipped workflow execution:', e instanceof Error ? e.message : 'Unknown error');
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
                console.error('Failed to create workflow execution log:', e instanceof Error ? e.message : 'Unknown error');
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
                console.error('Failed to update workflow execution log:', e instanceof Error ? e.message : 'Unknown error');
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
