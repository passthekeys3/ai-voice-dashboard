import type { WorkflowTrigger, WorkflowActionType, WorkflowCondition } from '@/types';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'crm' | 'alerts' | 'scheduling' | 'inbound';
    icon: string;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: Array<{ type: WorkflowActionType; config: Record<string, unknown> }>;
}

export const workflowTemplates: WorkflowTemplate[] = [
    {
        id: 'post-call-crm-ghl',
        name: 'Post-Call CRM Log (GHL)',
        description: 'Automatically log every completed call to GoHighLevel. Upserts the contact, logs call details, and applies sentiment-based tags.',
        category: 'crm',
        icon: '🟢',
        trigger: 'call_ended',
        conditions: [],
        actions: [
            {
                type: 'ghl_upsert_contact',
                config: { default_tags: 'ai-call', add_sentiment_tags: 'true' },
            },
            {
                type: 'ghl_log_call',
                config: {},
            },
            {
                type: 'ghl_add_tags',
                config: { always_add: 'ai-call' },
            },
        ],
    },
    {
        id: 'post-call-crm-hubspot',
        name: 'Post-Call CRM Log (HubSpot)',
        description: 'Automatically log every completed call to HubSpot. Upserts the contact, logs call details, and applies sentiment-based tags.',
        category: 'crm',
        icon: '🟠',
        trigger: 'call_ended',
        conditions: [],
        actions: [
            {
                type: 'hubspot_upsert_contact',
                config: { default_tags: 'ai-call', add_sentiment_tags: 'true' },
            },
            {
                type: 'hubspot_log_call',
                config: {},
            },
            {
                type: 'hubspot_add_tags',
                config: { always_add: 'ai-call' },
            },
        ],
    },
    {
        id: 'hot-lead-ghl',
        name: 'Hot Lead Pipeline (GHL)',
        description: 'Move positive, long-duration calls into your GHL sales pipeline and calculate a lead qualification score.',
        category: 'crm',
        icon: '🔥',
        trigger: 'call_ended',
        conditions: [
            { field: 'sentiment', operator: '==', value: 'positive' },
            { field: 'duration_seconds', operator: '>', value: 120 },
        ],
        actions: [
            {
                type: 'ghl_update_pipeline',
                config: { positive_stage_id: '', negative_stage_id: '', default_stage_id: '' },
            },
            {
                type: 'ghl_lead_score',
                config: { base_score: '50' },
            },
        ],
    },
    {
        id: 'hot-lead-hubspot',
        name: 'Hot Lead Pipeline (HubSpot)',
        description: 'Move positive, long-duration calls into your HubSpot deal pipeline and calculate a lead qualification score.',
        category: 'crm',
        icon: '🔥',
        trigger: 'call_ended',
        conditions: [
            { field: 'sentiment', operator: '==', value: 'positive' },
            { field: 'duration_seconds', operator: '>', value: 120 },
        ],
        actions: [
            {
                type: 'hubspot_update_pipeline',
                config: { pipeline_id: '', positive_stage_id: '', negative_stage_id: '' },
            },
            {
                type: 'hubspot_lead_score',
                config: { base_score: '50' },
            },
        ],
    },
    {
        id: 'negative-call-alert',
        name: 'Negative Call Alert',
        description: 'Send a webhook notification whenever a call ends with negative sentiment so your team can respond quickly.',
        category: 'alerts',
        icon: '🚨',
        trigger: 'call_ended',
        conditions: [
            { field: 'sentiment', operator: '==', value: 'negative' },
        ],
        actions: [
            {
                type: 'webhook',
                config: { url: '', method: 'POST' },
            },
        ],
    },
    {
        id: 'auto-book-ghl',
        name: 'Auto-Book Follow-up (GHL)',
        description: 'Automatically schedule a follow-up appointment in GoHighLevel when a call ends with positive sentiment.',
        category: 'scheduling',
        icon: '📅',
        trigger: 'call_ended',
        conditions: [
            { field: 'sentiment', operator: '==', value: 'positive' },
        ],
        actions: [
            {
                type: 'ghl_book_appointment',
                config: {
                    calendar_id: '',
                    days_ahead: '1',
                    duration_minutes: '30',
                    timezone: 'America/New_York',
                },
            },
        ],
    },
    {
        id: 'auto-book-hubspot',
        name: 'Auto-Book Follow-up (HubSpot)',
        description: 'Automatically schedule a follow-up meeting in HubSpot when a call ends with positive sentiment.',
        category: 'scheduling',
        icon: '📅',
        trigger: 'call_ended',
        conditions: [
            { field: 'sentiment', operator: '==', value: 'positive' },
        ],
        actions: [
            {
                type: 'hubspot_book_appointment',
                config: {
                    meeting_title: 'AI Call Follow-up',
                    days_ahead: '1',
                    preferred_hour: '10',
                    duration_minutes: '30',
                },
            },
        ],
    },
    {
        id: 'inbound-receptionist',
        name: 'Inbound Receptionist Log',
        description: 'Log every inbound call handled by the AI receptionist. Upserts the contact and attaches a detailed call note with transcript.',
        category: 'inbound',
        icon: '📞',
        trigger: 'inbound_call_ended',
        conditions: [],
        actions: [
            {
                type: 'ghl_upsert_contact',
                config: { default_tags: 'inbound-call,ai-receptionist' },
            },
            {
                type: 'ghl_add_call_note',
                config: { include_transcript: 'true', max_transcript_length: '2000' },
            },
        ],
    },
];
