/**
 * Shared whitelist of allowed workflow action types.
 *
 * Single source of truth — used by:
 *   • /api/workflows/route.ts  (POST validation)
 *   • /api/workflows/[id]/route.ts (PATCH validation)
 *   • /lib/workflows/ai-builder.ts (AI-generated workflow filtering)
 *
 * When adding a new action type, add it here *and* implement it in executor.ts.
 */

export const ALLOWED_ACTION_TYPES = new Set([
    'webhook',
    // GHL integrations
    'ghl_log_call', 'ghl_create_contact', 'ghl_add_tags', 'ghl_update_pipeline', 'ghl_lead_score',
    'ghl_book_appointment', 'ghl_cancel_appointment',
    'ghl_upsert_contact', 'ghl_add_call_note', 'ghl_trigger_workflow', 'ghl_update_contact_field',
    // HubSpot integrations
    'hubspot_log_call', 'hubspot_create_contact', 'hubspot_update_contact',
    'hubspot_add_tags', 'hubspot_update_pipeline', 'hubspot_lead_score',
    'hubspot_book_appointment', 'hubspot_cancel_appointment',
    'hubspot_upsert_contact', 'hubspot_add_call_note', 'hubspot_trigger_workflow', 'hubspot_update_contact_field',
    // Google Calendar integrations
    'gcal_book_event', 'gcal_cancel_event', 'gcal_check_availability',
    // Calendly integrations
    'calendly_check_availability', 'calendly_create_booking_link', 'calendly_cancel_event',
    // Messaging & notifications
    'send_sms', 'send_email', 'send_slack',
]);

export const ALLOWED_TRIGGERS = new Set([
    'call_ended', 'call_started',
    'inbound_call_started', 'inbound_call_ended',
]);

/** Convert the Set to an array for use in validation error messages. */
export const ALLOWED_ACTION_TYPES_LIST = [...ALLOWED_ACTION_TYPES];
export const ALLOWED_TRIGGERS_LIST = [...ALLOWED_TRIGGERS];
