/**
 * AI Agent Builder - Workflow Integration Templates
 *
 * Pre-built workflow templates that can be auto-created when an agent is built.
 * Each template maps to the existing Workflow schema in the database.
 */

import type { WorkflowTrigger, WorkflowCondition, WorkflowAction } from '@/types';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: {
        ghl: WorkflowAction[];
        hubspot: WorkflowAction[];
        gcal: WorkflowAction[];
        calendly: WorkflowAction[];
        slack: WorkflowAction[];
    };
}

// All templates use 'call_ended' trigger — this is intentional as all CRM actions run after a call completes
export const WORKFLOW_TEMPLATES = [
    {
        id: 'appointment_booking',
        name: 'Book Appointments',
        description: 'Automatically book appointments in your CRM when the agent schedules one during a call',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
        ],
        actions: {
            ghl: [{ type: 'ghl_book_appointment', config: {} }],
            hubspot: [{ type: 'hubspot_book_appointment', config: {} }],
            gcal: [{ type: 'gcal_book_event', config: {} }],
            calendly: [{ type: 'calendly_create_booking_link', config: {} }],
            slack: [],
        },
    },
    {
        id: 'call_logging',
        name: 'Log Calls',
        description: 'Log call details, duration, and outcomes to your CRM automatically',
        trigger: 'call_ended',
        conditions: [],
        actions: {
            ghl: [{ type: 'ghl_log_call', config: {} }],
            hubspot: [{ type: 'hubspot_log_call', config: {} }],
            gcal: [],
            calendly: [],
            slack: [],
        },
    },
    {
        id: 'contact_creation',
        name: 'Create/Update Contacts',
        description: 'Automatically create or update contacts in your CRM from call data',
        trigger: 'call_ended',
        conditions: [],
        actions: {
            ghl: [{ type: 'ghl_upsert_contact', config: {} }],
            hubspot: [{ type: 'hubspot_upsert_contact', config: {} }],
            gcal: [],
            calendly: [],
            slack: [],
        },
    },
    {
        id: 'lead_scoring',
        name: 'Score Leads',
        description: 'Automatically score leads based on call sentiment and conversion signals',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
        ],
        actions: {
            ghl: [{ type: 'ghl_lead_score', config: {} }],
            hubspot: [{ type: 'hubspot_lead_score', config: {} }],
            gcal: [],
            calendly: [],
            slack: [],
        },
    },
    {
        id: 'tagging',
        name: 'Tag Contacts',
        description: 'Add tags to contacts based on call results and outcomes',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
        ],
        actions: {
            ghl: [{ type: 'ghl_add_tags', config: { tags: ['ai-call'] } }],
            hubspot: [{ type: 'hubspot_add_tags', config: { tags: ['ai-call'] } }],
            gcal: [],
            calendly: [],
            slack: [],
        },
    },
    {
        id: 'pipeline_update',
        name: 'Update Pipeline',
        description: 'Move deals through pipeline stages based on call outcomes',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
        ],
        actions: {
            ghl: [{ type: 'ghl_update_pipeline', config: {} }],
            hubspot: [{ type: 'hubspot_update_pipeline', config: {} }],
            gcal: [],
            calendly: [],
            slack: [],
        },
    },
    {
        id: 'call_notes',
        name: 'Add Call Notes',
        description: 'Add detailed call summaries and notes to contact records',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
        ],
        actions: {
            ghl: [{ type: 'ghl_add_call_note', config: {} }],
            hubspot: [{ type: 'hubspot_add_call_note', config: {} }],
            gcal: [],
            calendly: [],
            slack: [],
        },
    },
    {
        id: 'slack_notification',
        name: 'Slack Call Notifications',
        description: 'Send a Slack notification with call summary and outcome after every call',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
        ],
        actions: {
            ghl: [],
            hubspot: [],
            gcal: [],
            calendly: [],
            slack: [{ type: 'send_slack', config: { message: 'Call with {{from_number}} completed ({{duration_minutes}} min). Sentiment: {{sentiment}}. Summary: {{summary}}' } }],
        },
    },
    {
        id: 'calendly_booking',
        name: 'Calendly Booking Link',
        description: 'Generate a one-time Calendly booking link after positive calls for follow-up scheduling',
        trigger: 'call_ended',
        conditions: [
            { field: 'status', operator: '==', value: 'completed' },
            { field: 'sentiment', operator: '==', value: 'positive' },
        ],
        actions: {
            ghl: [],
            hubspot: [],
            gcal: [],
            calendly: [{ type: 'calendly_create_booking_link', config: { max_event_count: '1' } }],
            slack: [],
        },
    },
] satisfies WorkflowTemplate[];

/**
 * Get templates that match the agency's active integrations
 */
export function getAvailableTemplates(
    hasGHL: boolean,
    hasHubSpot: boolean,
    hasGCal: boolean = false,
    hasCalendly: boolean = false,
    hasSlack: boolean = false,
): WorkflowTemplate[] {
    if (!hasGHL && !hasHubSpot && !hasGCal && !hasCalendly && !hasSlack) return [];

    return WORKFLOW_TEMPLATES.filter(template => {
        // Include template if the agency has at least one integration that has actions for it
        if (hasGHL && template.actions.ghl.length > 0) return true;
        if (hasHubSpot && template.actions.hubspot.length > 0) return true;
        if (hasGCal && template.actions.gcal.length > 0) return true;
        if (hasCalendly && template.actions.calendly.length > 0) return true;
        if (hasSlack && template.actions.slack.length > 0) return true;
        return false;
    });
}

/**
 * Get the correct actions for a template based on the agency's CRM
 */
export function getTemplateActions(
    template: WorkflowTemplate,
    crm: 'ghl' | 'hubspot' | 'gcal' | 'calendly' | 'slack'
): WorkflowAction[] {
    return template.actions[crm];
}

/**
 * Find a template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
    return WORKFLOW_TEMPLATES.find(t => t.id === id);
}
