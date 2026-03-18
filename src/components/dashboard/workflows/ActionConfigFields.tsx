'use client';

/**
 * ActionConfigFields — renders config form fields for each workflow action type.
 *
 * Architecture: Each action type declares its fields as data (FieldDefinition[]).
 * A single generic renderer turns those definitions into form elements.
 * This replaces 1,300 lines of 33 near-identical conditional JSX blocks.
 *
 * To add a new action type:
 *   1. Add the type to ActionTypeRegistry.ts
 *   2. Add a field definition entry to ACTION_FIELD_DEFINITIONS below
 *   3. Add the executor handler in lib/workflows/actions/
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Webhook } from 'lucide-react';
import type { WorkflowAction } from '@/types';

// ── Types ────────────────────────────────────────────────

interface ActionConfigFieldsProps {
    action: WorkflowAction & { _key: string };
    index: number;
    updateActionConfig: (index: number, key: string, value: string) => void;
}

/** Describes a single form field in an action's config panel */
interface FieldDefinition {
    /** Config key stored in action.config (e.g., 'url', 'tags', 'message') */
    key: string;
    /** Label displayed above the field */
    label: string;
    /** 'input' = single-line, 'textarea' = multi-line, 'switch' = boolean toggle */
    type: 'input' | 'textarea' | 'switch';
    /** Placeholder text for input/textarea fields */
    placeholder?: string;
    /** Help text displayed below the field */
    help?: string;
    /** Default value if config key is empty */
    defaultValue?: string;
    /** Number of rows for textarea fields (default: 3) */
    rows?: number;
    /** Whether to show the webhook icon (only for URL fields) */
    icon?: 'webhook';
}

// ── Shared help text (reused across multiple action types) ─

const TEMPLATE_VARS = '{{from_number}}, {{to_number}}, {{agent_name}}, {{summary}}, {{sentiment}}, {{duration_minutes}}, {{recording_url}}';
const TEMPLATE_VARS_HELP = `Variables: ${TEMPLATE_VARS}`;
const TRANSCRIPT_LIMIT_HELP = 'Max characters of transcript to include (0 = none)';

// ── Field definitions per action type ────────────────────
// Each action type maps to an array of fields to render.
// Order matters — fields render top to bottom.

const ACTION_FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
    // ── Webhook ──────────────────────────────────────────
    webhook: [
        { key: 'url', label: 'Webhook URL *', type: 'input', placeholder: 'https://hooks.zapier.com/...', help: "We'll POST call data (transcript, summary, recording, etc.) to this URL", icon: 'webhook' },
    ],

    // ── GoHighLevel ──────────────────────────────────────
    ghl_create_contact: [
        { key: 'tags', label: 'Tags (comma-separated)', type: 'input', placeholder: 'ai-call, inbound, lead', help: 'Tags to apply when creating the contact' },
    ],
    ghl_log_call: [
        { key: 'max_transcript_length', label: 'Max Transcript Length', type: 'input', placeholder: '2000', help: TRANSCRIPT_LIMIT_HELP },
    ],
    ghl_add_tags: [
        { key: 'tags', label: 'Tags (comma-separated) *', type: 'input', placeholder: 'ai-call, qualified-lead', help: 'Tags to apply to the contact' },
        { key: 'conditional_tags', label: 'Conditional Tags (JSON)', type: 'textarea', placeholder: '{"positive": ["satisfied", "follow-up"], "negative": ["needs-review"]}', rows: 4, help: 'Apply tags based on sentiment. Format: {"sentiment": ["tag1", "tag2"]}' },
        { key: 'tag_completed', label: 'Completed Call Tag', type: 'input', placeholder: 'call-completed', help: 'Tag added when a call completes successfully' },
        { key: 'tag_failed', label: 'Failed Call Tag', type: 'input', placeholder: 'call-failed', help: 'Tag added when a call fails or errors' },
        { key: 'tag_short', label: 'Short Call Tag', type: 'input', placeholder: 'short-call', help: 'Tag added when call is under 30 seconds' },
        { key: 'short_call_threshold', label: 'Short Call Threshold (seconds)', type: 'input', placeholder: '30', help: 'Calls shorter than this are tagged as short' },
    ],
    ghl_update_pipeline: [
        { key: 'pipeline_id', label: 'Pipeline ID *', type: 'input', placeholder: 'pipeline_abc123' },
        { key: 'stage_id', label: 'Stage ID *', type: 'input', placeholder: 'stage_xyz789' },
        { key: 'deal_name', label: 'Deal/Opportunity Name', type: 'input', placeholder: '{{agent_name}} Call - {{from_number}}', help: 'Template for the deal name. Leave empty for default.' },
        { key: 'deal_value', label: 'Deal Value ($)', type: 'input', placeholder: '0', help: 'Monetary value for the opportunity (in dollars)' },
        { key: 'conditional_stages', label: 'Conditional Stage Mapping (JSON)', type: 'textarea', placeholder: '{"positive": "stage_qualified", "negative": "stage_nurture"}', rows: 3, help: 'Move to different stages based on call sentiment. Format: {"sentiment": "stage_id"}' },
    ],
    ghl_lead_score: [
        { key: 'score_field', label: 'Custom Field for Score', type: 'input', placeholder: 'ai_lead_score', help: 'GHL custom field name to store the score (1-100)' },
        { key: 'score_weights', label: 'Score Weights (JSON)', type: 'textarea', placeholder: '{"sentiment": 40, "duration": 30, "outcome": 30}', rows: 3, help: 'Customize scoring weights. Must sum to 100.' },
        { key: 'min_score_tag', label: 'Low Score Tag', type: 'input', placeholder: 'cold-lead', help: 'Tag for leads scoring below threshold' },
        { key: 'max_score_tag', label: 'High Score Tag', type: 'input', placeholder: 'hot-lead', help: 'Tag for leads scoring above threshold' },
        { key: 'score_threshold', label: 'Hot Lead Threshold', type: 'input', placeholder: '70', help: 'Score above this = hot lead, below = cold lead' },
        { key: 'update_pipeline', label: 'Also Update Pipeline Stage', type: 'switch' },
        { key: 'hot_stage_id', label: 'Hot Lead Stage ID', type: 'input', placeholder: 'stage_hot_lead', help: 'Pipeline stage for hot leads (when above threshold)' },
        { key: 'cold_stage_id', label: 'Cold Lead Stage ID', type: 'input', placeholder: 'stage_nurture', help: 'Pipeline stage for cold leads (when below threshold)' },
    ],
    ghl_book_appointment: [
        { key: 'calendar_id', label: 'Calendar ID *', type: 'input', placeholder: 'cal_abc123', help: 'GHL calendar ID (from Calendar settings)' },
        { key: 'appointment_title', label: 'Appointment Title', type: 'input', placeholder: 'Follow-up from AI call', help: TEMPLATE_VARS_HELP },
        { key: 'appointment_description', label: 'Description', type: 'textarea', placeholder: 'Call summary: {{summary}}', rows: 3, help: TEMPLATE_VARS_HELP },
        { key: 'slot_duration', label: 'Duration (minutes)', type: 'input', placeholder: '30', help: 'Default slot duration' },
        { key: 'days_ahead', label: 'Days Ahead to Search', type: 'input', placeholder: '7', help: 'How many days ahead to look for available slots' },
        { key: 'preferred_time', label: 'Preferred Time', type: 'input', placeholder: '10:00', help: 'Preferred time of day (HH:MM, 24h). Closest slot will be picked.' },
        { key: 'timezone', label: 'Timezone Override', type: 'input', placeholder: 'America/New_York', help: 'Leave empty to use lead timezone (detected from phone number)' },
        { key: 'notify_contact', label: 'Notify Contact', type: 'switch' },
    ],
    ghl_cancel_appointment: [
        { key: 'cancel_reason', label: 'Cancellation Reason', type: 'input', placeholder: 'Cancelled via AI call', help: 'Reason sent to GHL' },
        { key: 'cancel_most_recent', label: 'Cancel Most Recent Appointment', type: 'switch' },
    ],
    ghl_upsert_contact: [
        { key: 'tags', label: 'Tags (comma-separated)', type: 'input', placeholder: 'ai-call, inbound', help: 'Tags to apply to the contact' },
        { key: 'source', label: 'Contact Source', type: 'input', placeholder: 'BuildVoiceAI', help: 'Source field for new contacts' },
        { key: 'log_call', label: 'Also Log Call Note', type: 'switch' },
        { key: 'max_transcript_length', label: 'Max Transcript Length', type: 'input', placeholder: '2000', help: TRANSCRIPT_LIMIT_HELP },
    ],
    ghl_add_call_note: [
        { key: 'note_template', label: 'Note Template', type: 'textarea', placeholder: 'AI Call Summary\nAgent: {{agent_name}}\nDuration: {{duration_minutes}} min\nSentiment: {{sentiment}}\n\n{{summary}}', rows: 5, help: TEMPLATE_VARS_HELP },
        { key: 'max_transcript_length', label: 'Max Transcript Length', type: 'input', placeholder: '2000', help: TRANSCRIPT_LIMIT_HELP },
    ],
    ghl_trigger_workflow: [
        { key: 'workflow_id', label: 'GHL Workflow ID *', type: 'input', placeholder: 'workflow_abc123', help: 'The GHL workflow to trigger (found in Automations)' },
        { key: 'pass_call_data', label: 'Include Call Data', type: 'switch' },
    ],
    ghl_update_contact_field: [
        { key: 'field_key', label: 'Custom Field Key *', type: 'input', placeholder: 'ai_call_summary', help: 'The GHL custom field key to update' },
        { key: 'field_value', label: 'Field Value *', type: 'input', placeholder: '{{summary}}', help: TEMPLATE_VARS_HELP },
        { key: 'create_if_missing', label: 'Create contact if not found', type: 'switch' },
    ],

    // ── HubSpot ──────────────────────────────────────────
    hubspot_log_call: [
        { key: 'max_transcript_length', label: 'Max Transcript Length', type: 'input', placeholder: '5000', help: TRANSCRIPT_LIMIT_HELP },
    ],
    hubspot_create_contact: [
        { key: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'input', placeholder: 'lead', help: 'HubSpot lifecycle stage (lead, subscriber, opportunity, customer, etc.)' },
        { key: 'lead_status', label: 'Lead Status', type: 'input', placeholder: 'NEW', help: 'HubSpot lead status property value' },
        { key: 'source', label: 'Original Source', type: 'input', placeholder: 'AI_VOICE_CALL', help: 'Value for the hs_analytics_source property' },
    ],
    hubspot_update_contact: [
        { key: 'properties', label: 'Properties to Update (JSON)', type: 'textarea', placeholder: '{"ai_call_summary": "{{summary}}", "ai_call_sentiment": "{{sentiment}}"}', rows: 4, help: 'Map of HubSpot property names → template values' },
        { key: 'update_existing_only', label: 'Only Update Existing Contacts', type: 'switch' },
    ],
    hubspot_upsert_contact: [
        { key: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'input', placeholder: 'lead', help: 'HubSpot lifecycle stage for new contacts' },
        { key: 'source', label: 'Contact Source', type: 'input', placeholder: 'AI_VOICE_CALL', help: 'Source attribution for new contacts' },
        { key: 'tags', label: 'Tags (semicolon-separated)', type: 'input', placeholder: 'ai-call;inbound', help: 'Tags to apply (stored in ai_call_tags property)' },
        { key: 'log_call', label: 'Also Log Call Engagement', type: 'switch' },
    ],
    hubspot_add_call_note: [
        { key: 'note_template', label: 'Note Template', type: 'textarea', placeholder: 'AI Call Summary\nAgent: {{agent_name}}\nDuration: {{duration_minutes}} min\nSentiment: {{sentiment}}\n\n{{summary}}', rows: 5, help: TEMPLATE_VARS_HELP },
        { key: 'max_transcript_length', label: 'Max Transcript Length', type: 'input', placeholder: '5000', help: TRANSCRIPT_LIMIT_HELP },
    ],
    hubspot_add_tags: [
        { key: 'tags', label: 'Tags (semicolon-separated) *', type: 'input', placeholder: 'ai-call;qualified', help: 'Tags to apply (stored in ai_call_tags custom property)' },
        { key: 'conditional_tags', label: 'Conditional Tags (JSON)', type: 'textarea', placeholder: '{"positive": ["satisfied", "follow-up"], "negative": ["needs-review"]}', rows: 4, help: 'Apply tags based on sentiment. Format: {"sentiment": ["tag1", "tag2"]}' },
        { key: 'tag_completed', label: 'Completed Call Tag', type: 'input', placeholder: 'call-completed' },
        { key: 'tag_failed', label: 'Failed Call Tag', type: 'input', placeholder: 'call-failed' },
        { key: 'tag_short', label: 'Short Call Tag', type: 'input', placeholder: 'short-call' },
        { key: 'short_call_threshold', label: 'Short Call Threshold (seconds)', type: 'input', placeholder: '30' },
    ],
    hubspot_update_pipeline: [
        { key: 'pipeline_id', label: 'Pipeline ID *', type: 'input', placeholder: 'default', help: "HubSpot pipeline ID (use 'default' for default pipeline)" },
        { key: 'stage_id', label: 'Deal Stage ID *', type: 'input', placeholder: 'qualifiedtobuy', help: 'HubSpot deal stage ID' },
        { key: 'deal_name', label: 'Deal Name', type: 'input', placeholder: '{{agent_name}} Call - {{from_number}}', help: TEMPLATE_VARS_HELP },
        { key: 'deal_amount', label: 'Deal Amount ($)', type: 'input', placeholder: '0' },
        { key: 'conditional_stages', label: 'Conditional Stage Mapping (JSON)', type: 'textarea', placeholder: '{"positive": "qualifiedtobuy", "negative": "appointmentscheduled"}', rows: 3, help: 'Move to different stages based on call sentiment' },
    ],
    hubspot_lead_score: [
        { key: 'score_property', label: 'Score Property', type: 'input', placeholder: 'ai_lead_score', help: 'HubSpot contact property to store the score (1-100)' },
        { key: 'score_weights', label: 'Score Weights (JSON)', type: 'textarea', placeholder: '{"sentiment": 40, "duration": 30, "outcome": 30}', rows: 3, help: 'Customize scoring weights. Must sum to 100.' },
        { key: 'min_score_tag', label: 'Low Score Tag', type: 'input', placeholder: 'cold-lead' },
        { key: 'max_score_tag', label: 'High Score Tag', type: 'input', placeholder: 'hot-lead' },
        { key: 'score_threshold', label: 'Hot Lead Threshold', type: 'input', placeholder: '70' },
        { key: 'update_pipeline', label: 'Also Update Deal Stage', type: 'switch' },
        { key: 'hot_stage_id', label: 'Hot Lead Stage ID', type: 'input', placeholder: 'qualifiedtobuy' },
        { key: 'cold_stage_id', label: 'Cold Lead Stage ID', type: 'input', placeholder: 'appointmentscheduled' },
    ],
    hubspot_book_appointment: [
        { key: 'meeting_title', label: 'Meeting Title', type: 'input', placeholder: 'Follow-up from AI call', help: TEMPLATE_VARS_HELP },
        { key: 'meeting_description', label: 'Description', type: 'textarea', placeholder: 'Call summary: {{summary}}', rows: 3, help: TEMPLATE_VARS_HELP },
        { key: 'duration_minutes', label: 'Duration (minutes)', type: 'input', placeholder: '30' },
        { key: 'days_ahead', label: 'Days Ahead to Search', type: 'input', placeholder: '7' },
        { key: 'preferred_time', label: 'Preferred Time (HH:MM)', type: 'input', placeholder: '10:00', help: 'Preferred time of day (24h format)' },
        { key: 'timezone', label: 'Timezone Override', type: 'input', placeholder: 'America/New_York', help: 'Leave empty to use lead timezone' },
        { key: 'owner_id', label: 'HubSpot Owner ID', type: 'input', placeholder: '', help: 'Leave empty to use default owner' },
    ],
    hubspot_cancel_appointment: [
        { key: 'cancel_reason', label: 'Cancellation Reason', type: 'input', placeholder: 'Cancelled via AI call' },
        { key: 'cancel_most_recent', label: 'Cancel Most Recent Meeting', type: 'switch' },
    ],
    hubspot_trigger_workflow: [
        { key: 'workflow_id', label: 'HubSpot Workflow ID *', type: 'input', placeholder: '12345', help: 'The numeric workflow/flow ID from HubSpot Automations' },
        { key: 'pass_call_data', label: 'Include Call Data', type: 'switch' },
    ],
    hubspot_update_contact_field: [
        { key: 'property_name', label: 'Property Internal Name *', type: 'input', placeholder: 'ai_call_summary', help: 'The HubSpot contact property internal name' },
        { key: 'property_value', label: 'Property Value *', type: 'input', placeholder: '{{summary}}', help: TEMPLATE_VARS_HELP },
        { key: 'create_if_missing', label: 'Create contact if not found', type: 'switch' },
    ],

    // ── Google Calendar ──────────────────────────────────
    gcal_book_event: [
        { key: 'event_title', label: 'Event Title *', type: 'input', placeholder: 'Follow-up: {{agent_name}} call', help: TEMPLATE_VARS_HELP },
        { key: 'event_description', label: 'Description', type: 'textarea', placeholder: 'Call summary: {{summary}}\nCaller: {{from_number}}', rows: 3, help: TEMPLATE_VARS_HELP },
        { key: 'duration_minutes', label: 'Duration (minutes)', type: 'input', placeholder: '30' },
        { key: 'days_ahead', label: 'Days Ahead to Search', type: 'input', placeholder: '7', help: 'How far ahead to search for free slots' },
        { key: 'preferred_time', label: 'Preferred Time (HH:MM)', type: 'input', placeholder: '10:00', help: '24h format. Closest available slot will be chosen.' },
        { key: 'timezone', label: 'Timezone Override', type: 'input', placeholder: 'America/New_York', help: 'Leave empty to use lead timezone (auto-detected from phone)' },
        { key: 'attendee_email', label: 'Attendee Email', type: 'input', placeholder: '', help: 'Email to add as attendee. Leave empty for no attendee.' },
        { key: 'calendar_id', label: 'Calendar ID Override', type: 'input', placeholder: 'primary', help: 'Leave empty to use agency default calendar' },
        { key: 'buffer_minutes', label: 'Buffer Between Events (minutes)', type: 'input', placeholder: '15', help: 'Minimum gap between events' },
        { key: 'working_hours_start', label: 'Working Hours Start', type: 'input', placeholder: '09:00', help: 'Only book during business hours (24h)' },
        { key: 'working_hours_end', label: 'Working Hours End', type: 'input', placeholder: '17:00' },
    ],
    gcal_cancel_event: [
        { key: 'cancel_reason', label: 'Cancellation Message', type: 'input', placeholder: 'Cancelled via AI call', help: 'Sent to attendees if notifications are enabled' },
        { key: 'cancel_most_recent', label: 'Cancel Most Recent Event', type: 'switch' },
        { key: 'send_notifications', label: 'Notify Attendees', type: 'switch' },
    ],
    gcal_check_availability: [
        { key: 'days_ahead', label: 'Days Ahead to Check', type: 'input', placeholder: '7' },
        { key: 'slot_duration', label: 'Slot Duration (minutes)', type: 'input', placeholder: '30' },
        { key: 'max_slots', label: 'Max Slots to Return', type: 'input', placeholder: '5' },
        { key: 'working_hours_start', label: 'Working Hours Start', type: 'input', placeholder: '09:00' },
        { key: 'working_hours_end', label: 'Working Hours End', type: 'input', placeholder: '17:00' },
    ],

    // ── Communication ────────────────────────────────────
    send_sms: [
        { key: 'to', label: 'Recipient Phone Number', type: 'input', defaultValue: '{{from_number}}', placeholder: '{{from_number}} or +1234567890', help: "Use {{from_number}} to send to the caller's number" },
        { key: 'message', label: 'Message *', type: 'textarea', placeholder: "Hi! Thanks for your call with {{agent_name}}. Here's a summary: {{summary}}", rows: 3, help: TEMPLATE_VARS_HELP },
    ],
    send_email: [
        { key: 'to', label: 'Recipient Email *', type: 'input', placeholder: 'customer@example.com' },
        { key: 'subject', label: 'Subject *', type: 'input', placeholder: 'Call Summary from {{agent_name}}' },
        { key: 'body', label: 'Email Body (HTML supported)', type: 'textarea', placeholder: '<p>Hi,</p><p>Here is a summary of your call: {{summary}}</p>', rows: 5, help: TEMPLATE_VARS_HELP },
    ],
    send_slack: [
        { key: 'webhook_url', label: 'Webhook URL Override', type: 'input', placeholder: 'Leave empty to use agency default', help: 'Optional — uses the webhook URL from Settings if not specified' },
        { key: 'message_template', label: 'Message Template', type: 'textarea', placeholder: '*New call completed*\nAgent: {{agent_name}}\nDuration: {{duration_minutes}} min\nSentiment: {{sentiment}}\n\n{{summary}}', rows: 5, help: TEMPLATE_VARS_HELP },
    ],

    // ── Calendly ─────────────────────────────────────────
    calendly_check_availability: [
        { key: 'days_ahead', label: 'Days Ahead to Check', type: 'input', placeholder: '7' },
        { key: 'max_slots', label: 'Max Slots to Return', type: 'input', placeholder: '5' },
    ],
    calendly_create_booking_link: [
        { key: 'event_type_uri', label: 'Event Type URI', type: 'input', placeholder: 'https://api.calendly.com/event_types/...', help: 'Leave empty to use agency default event type' },
        { key: 'max_event_count', label: 'Max Bookings', type: 'input', placeholder: '1', help: 'Maximum number of bookings allowed on this link' },
        { key: 'name', label: 'Booking Link Name', type: 'input', placeholder: '{{agent_name}} Follow-Up', help: TEMPLATE_VARS_HELP },
    ],
    calendly_cancel_event: [
        { key: 'cancel_reason', label: 'Cancellation Reason', type: 'input', placeholder: 'Cancelled via AI call' },
        { key: 'cancel_most_recent', label: 'Cancel Most Recent Event', type: 'switch' },
    ],
};

// ── Generic field renderer ───────────────────────────────

/** Renders a single form field from its definition */
function ConfigField({
    field,
    action,
    index,
    updateActionConfig,
}: {
    field: FieldDefinition;
    action: WorkflowAction;
    index: number;
    updateActionConfig: (index: number, key: string, value: string) => void;
}) {
    const fieldId = `action-${index}-${field.key}`;
    const currentValue = (action.config[field.key] as string) || field.defaultValue || '';

    if (field.type === 'switch') {
        return (
            <div className="flex items-center gap-2">
                <Switch
                    id={fieldId}
                    checked={currentValue === 'true'}
                    onCheckedChange={(checked: boolean) => updateActionConfig(index, field.key, String(checked))}
                />
                <Label htmlFor={fieldId}>{field.label}</Label>
            </div>
        );
    }

    const InputComponent = field.type === 'textarea' ? Textarea : Input;

    return (
        <div className="space-y-2">
            <Label htmlFor={fieldId}>{field.label}</Label>
            {field.icon === 'webhook' ? (
                <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-muted-foreground" />
                    <InputComponent
                        id={fieldId}
                        value={currentValue}
                        onChange={(e) => updateActionConfig(index, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="flex-1"
                        {...(field.type === 'textarea' ? { rows: field.rows || 3 } : {})}
                    />
                </div>
            ) : (
                <InputComponent
                    id={fieldId}
                    value={currentValue}
                    onChange={(e) => updateActionConfig(index, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    {...(field.type === 'textarea' ? { rows: field.rows || 3 } : {})}
                />
            )}
            {field.help && (
                <p className="text-xs text-muted-foreground">{field.help}</p>
            )}
        </div>
    );
}

// ── Main component ───────────────────────────────────────

export function ActionConfigFields({ action, index, updateActionConfig }: ActionConfigFieldsProps) {
    const fields = ACTION_FIELD_DEFINITIONS[action.type];

    // Unknown action type — no config fields to show
    if (!fields) return null;

    return (
        <div className="space-y-3">
            {fields.map((field) => (
                <ConfigField
                    key={field.key}
                    field={field}
                    action={action}
                    index={index}
                    updateActionConfig={updateActionConfig}
                />
            ))}
        </div>
    );
}
