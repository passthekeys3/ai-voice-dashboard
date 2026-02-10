/**
 * AI Workflow Builder - Natural Language → Workflow Generation
 *
 * Uses Claude to generate complete workflow configurations from plain English descriptions.
 * Follows the same streaming pattern as the Agent Builder (llm.ts).
 */

import Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import type { WorkflowTrigger, WorkflowCondition, WorkflowAction } from '@/types';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_OUTPUT_TOKENS = 4096;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
    if (!anthropicClient) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }
        anthropicClient = new Anthropic({ apiKey });
    }
    return anthropicClient;
}

// Whitelist of allowed action types (must match /api/workflows/route.ts)
const ALLOWED_ACTION_TYPES = new Set([
    'webhook',
    'ghl_log_call', 'ghl_create_contact', 'ghl_add_tags', 'ghl_update_pipeline', 'ghl_lead_score',
    'ghl_book_appointment', 'ghl_cancel_appointment',
    'ghl_upsert_contact', 'ghl_add_call_note', 'ghl_trigger_workflow', 'ghl_update_contact_field',
    'hubspot_log_call', 'hubspot_create_contact', 'hubspot_update_contact',
    'hubspot_add_tags', 'hubspot_update_pipeline', 'hubspot_lead_score',
    'hubspot_book_appointment', 'hubspot_cancel_appointment',
    'hubspot_upsert_contact', 'hubspot_add_call_note', 'hubspot_trigger_workflow', 'hubspot_update_contact_field',
    'gcal_book_event', 'gcal_cancel_event', 'gcal_check_availability',
    'calendly_check_availability', 'calendly_create_booking_link', 'calendly_cancel_event',
    'send_sms', 'send_email', 'send_slack',
]);

const ALLOWED_TRIGGERS = new Set([
    'call_ended', 'call_started',
    'inbound_call_started', 'inbound_call_ended',
]);

export interface AIWorkflowResponse {
    message: string;
    workflow: {
        name: string;
        description: string;
        trigger: WorkflowTrigger;
        conditions: WorkflowCondition[];
        actions: WorkflowAction[];
    } | null;
}

interface WorkflowBuilderContext {
    hasGHL: boolean;
    hasHubSpot: boolean;
    hasGCal: boolean;
    hasCalendly: boolean;
    hasSlack: boolean;
}

const SYSTEM_PROMPT = `You are an expert workflow automation builder for a voice AI call center platform. You help users create post-call automation workflows by generating complete workflow configurations from natural language descriptions.

## Platform Context
This platform manages AI voice agents that make and receive phone calls. After each call, workflows can automatically run actions like logging data to CRMs, booking appointments, sending notifications, tagging contacts, etc.

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "message": "A brief explanation of the workflow you created and why you chose these actions",
  "workflow": {
    "name": "Short workflow name",
    "description": "One sentence describing what this workflow does",
    "trigger": "call_ended",
    "conditions": [
      { "field": "status", "operator": "==", "value": "completed" }
    ],
    "actions": [
      { "type": "action_type", "config": { ... } }
    ]
  }
}

If the user's request is unclear or you need more information, set "workflow" to null and ask a clarifying question in "message".

## Available Triggers
- "call_ended" — Fires when any call ends (most common, use as default)
- "call_started" — Fires when any call starts
- "inbound_call_started" — Fires when an inbound call starts
- "inbound_call_ended" — Fires when an inbound call ends

## Condition Fields
Use these to filter which calls trigger the workflow:
- "status" — Call completion status: "completed", "failed", "busy", "no_answer"
- "sentiment" — AI-detected sentiment: "positive", "neutral", "negative"
- "duration_seconds" — Call duration in seconds (number)
- "direction" — "inbound" or "outbound"
- "from_number" — Caller's phone number (string)
- "to_number" — Called phone number (string)
- "cost_cents" — Call cost in cents (number)
- "agent_name" — Name of the AI agent (string)
- "summary" — Call summary text (string, use "contains" operator)
- "transcript" — Full transcript text (string, use "contains" operator)

## Condition Operators
- "==" — equals
- "!=" — not equals
- ">" — greater than (for numbers)
- "<" — less than (for numbers)
- ">=" — greater or equal
- "<=" — less or equal
- "contains" — text contains substring
- "not_contains" — text does not contain substring

## Available Template Variables
Use these in action configs (they get replaced with actual call data at runtime):
- {{from_number}} — Caller's phone number
- {{to_number}} — Called number
- {{duration_seconds}} — Call duration
- {{duration_minutes}} — Duration in minutes (rounded)
- {{status}} — Call status
- {{sentiment}} — Detected sentiment
- {{summary}} — AI call summary
- {{transcript}} — Full transcript
- {{agent_name}} — Agent name
- {{call_id}} — Unique call ID
- {{direction}} — inbound/outbound
- {{started_at}} — Call start timestamp
- {{ended_at}} — Call end timestamp

## Available Action Types

### GoHighLevel (GHL) Actions
Only suggest these if the user has GHL connected:
- "ghl_log_call" — Log call to GHL contact. Config: {}
- "ghl_create_contact" — Create GHL contact. Config: {}
- "ghl_upsert_contact" — Find or create contact with call data. Config: {}
- "ghl_add_call_note" — Add call summary as note. Config: {}
- "ghl_add_tags" — Auto-tag contact. Config: { "tags": ["tag1", "tag2"] }
- "ghl_update_pipeline" — Move deal in pipeline. Config: { "pipeline_id": "", "stage_id": "" } (leave empty for auto)
- "ghl_lead_score" — Calculate and store lead score. Config: {}
- "ghl_book_appointment" — Book appointment. Config: { "calendar_id": "" } (leave empty for default)
- "ghl_cancel_appointment" — Cancel appointment. Config: {}
- "ghl_trigger_workflow" — Trigger GHL automation. Config: { "workflow_id": "" }
- "ghl_update_contact_field" — Update custom field. Config: { "field_key": "", "value": "{{summary}}" }

### HubSpot Actions
Only suggest these if the user has HubSpot connected:
- "hubspot_log_call" — Log call engagement. Config: {}
- "hubspot_create_contact" — Create HubSpot contact. Config: {}
- "hubspot_update_contact" — Update contact properties. Config: {}
- "hubspot_upsert_contact" — Find or create contact. Config: {}
- "hubspot_add_call_note" — Add call summary as note. Config: {}
- "hubspot_add_tags" — Apply tags. Config: { "tags": ["tag1", "tag2"] }
- "hubspot_update_pipeline" — Create/move deal. Config: { "pipeline_id": "", "stage_id": "" }
- "hubspot_lead_score" — Calculate lead score. Config: {}
- "hubspot_book_appointment" — Schedule meeting. Config: {}
- "hubspot_cancel_appointment" — Cancel meeting. Config: {}
- "hubspot_trigger_workflow" — Enroll in HubSpot workflow. Config: { "workflow_id": "" }
- "hubspot_update_contact_field" — Set contact property. Config: { "property": "", "value": "" }

### Google Calendar Actions
Only suggest if Google Calendar is connected:
- "gcal_book_event" — Find next slot and book. Config: { "calendar_id": "", "duration_minutes": 30 }
- "gcal_cancel_event" — Cancel event. Config: {}
- "gcal_check_availability" — Check free/busy. Config: {}

### Calendly Actions
Only suggest if Calendly is connected:
- "calendly_create_booking_link" — Generate one-time booking link. Config: { "max_event_count": "1" }
- "calendly_check_availability" — Check availability. Config: {}
- "calendly_cancel_event" — Cancel event. Config: {}

### Messaging & Notification Actions
- "send_slack" — Post to Slack (only if Slack connected). Config: { "message": "Call with {{from_number}}: {{summary}}" }
- "send_sms" — Send SMS to caller. Config: { "to": "{{from_number}}", "message": "Thank you for calling! ..." }
- "send_email" — Send email. Config: { "to": "email@example.com", "subject": "Call Summary", "body": "..." }
- "webhook" — POST data to URL. Config: { "url": "https://...", "headers": {} }

## Rules
1. ONLY suggest action types that match the user's connected integrations
2. Always include at least one condition (typically status == completed) unless the user explicitly wants all calls
3. Default trigger should be "call_ended" unless the user specifies otherwise
4. Use template variables in configs where appropriate
5. Order actions logically (e.g., create contact before logging call)
6. Keep workflow names concise (under 50 chars)
7. If the user mentions a CRM but doesn't have it connected, explain they need to connect it first
8. Never suggest action types not in the allowed list above`;

/**
 * Build the user prompt with integration context
 */
function buildWorkflowPrompt(
    message: string,
    context: WorkflowBuilderContext,
    agents: { id: string; name: string }[]
): string {
    const integrations = [];
    if (context.hasGHL) integrations.push('GoHighLevel (GHL)');
    if (context.hasHubSpot) integrations.push('HubSpot');
    if (context.hasGCal) integrations.push('Google Calendar');
    if (context.hasCalendly) integrations.push('Calendly');
    if (context.hasSlack) integrations.push('Slack');

    const contextParts = [];
    if (integrations.length > 0) {
        contextParts.push(`Connected integrations: ${integrations.join(', ')}`);
    } else {
        contextParts.push('No CRM integrations connected. Only webhook, SMS, and email actions are available.');
    }

    if (agents.length > 0) {
        const agentNames = agents.slice(0, 10).map(a => a.name).join(', ');
        contextParts.push(`Available agents: ${agentNames}`);
    }

    return `[Context: ${contextParts.join('. ')}]\n\n${message}`;
}

/**
 * Validate generated actions against allowed types
 */
function validateWorkflowResponse(response: AIWorkflowResponse): AIWorkflowResponse {
    if (!response.workflow) return response;

    // Validate trigger
    if (!ALLOWED_TRIGGERS.has(response.workflow.trigger)) {
        response.workflow.trigger = 'call_ended';
    }

    // Filter out invalid action types
    response.workflow.actions = response.workflow.actions.filter(
        action => action.type && ALLOWED_ACTION_TYPES.has(action.type)
    );

    // Ensure each action has a config object
    response.workflow.actions = response.workflow.actions.map(action => ({
        type: action.type,
        config: action.config || {},
    }));

    // If no valid actions remain, null out the workflow
    if (response.workflow.actions.length === 0) {
        return {
            message: response.message + '\n\nNote: The generated actions were invalid. Please try describing your workflow differently.',
            workflow: null,
        };
    }

    return response;
}

/**
 * Generate a workflow configuration via Claude (streaming)
 * Returns a ReadableStream with newline-delimited JSON chunks
 */
export async function generateWorkflowStream(
    message: string,
    context: WorkflowBuilderContext,
    agents: { id: string; name: string }[]
): Promise<ReadableStream<Uint8Array>> {
    const client = getClient();
    const userPrompt = buildWorkflowPrompt(message, context, agents);

    const stream = await client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
    });

    const encoder = new TextEncoder();
    let fullText = '';

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const event of stream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        fullText += event.delta.text;
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({ type: 'text_delta', text: event.delta.text }) + '\n'
                            )
                        );
                    }
                }

                // Parse the complete response
                const parsed = parseWorkflowResponse(fullText);
                const validated = validateWorkflowResponse(parsed);

                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({ type: 'result', data: validated }) + '\n'
                    )
                );

                controller.close();
            } catch (error) {
                const errorMessage = error instanceof APIError
                    ? getAPIErrorMessage(error)
                    : 'Failed to generate workflow';

                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({ type: 'error', error: errorMessage }) + '\n'
                    )
                );
                controller.close();
            }
        },
    });
}

/**
 * Parse Claude's response into a structured workflow response
 */
function parseWorkflowResponse(text: string): AIWorkflowResponse {
    try {
        const trimmed = text.trim();
        const jsonStr = trimmed.startsWith('```')
            ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
            : trimmed;
        return JSON.parse(jsonStr);
    } catch {
        return {
            message: text,
            workflow: null,
        };
    }
}

function getAPIErrorMessage(error: APIError): string {
    if (error.status === 401) return 'AI service authentication failed. Check your API key.';
    if (error.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (error.status === 529) return 'AI service is temporarily overloaded. Please try again.';
    return 'Failed to generate workflow. Please try again.';
}
