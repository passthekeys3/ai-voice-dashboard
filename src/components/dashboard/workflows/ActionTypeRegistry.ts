export const actionTypes = [
    { value: 'webhook', label: 'Send Webhook', description: 'POST data to any URL' },
    // GoHighLevel actions
    { value: 'ghl_log_call', label: 'Log to GoHighLevel', description: 'Add a note to the contact' },
    { value: 'ghl_create_contact', label: 'Create GHL Contact', description: 'Create a new contact if not found' },
    { value: 'ghl_upsert_contact', label: 'Upsert GHL Contact', description: 'Find or create contact with call data' },
    { value: 'ghl_add_call_note', label: 'Add Call Note (GHL)', description: 'Push call summary and transcript as note' },
    { value: 'ghl_add_tags', label: 'Auto-Tag Contact (GHL)', description: 'Apply tags based on call outcome' },
    { value: 'ghl_update_pipeline', label: 'Update Pipeline Stage', description: 'Move contact in pipeline' },
    { value: 'ghl_lead_score', label: 'Lead Qualification Score', description: 'Calculate and store lead score' },
    { value: 'ghl_book_appointment', label: 'Book Appointment (GHL)', description: 'Schedule next available slot' },
    { value: 'ghl_cancel_appointment', label: 'Cancel Appointment (GHL)', description: 'Cancel an existing appointment' },
    { value: 'ghl_trigger_workflow', label: 'Trigger GHL Workflow', description: 'Start a GHL automation (SMS, email, etc.)' },
    { value: 'ghl_update_contact_field', label: 'Update Contact Field (GHL)', description: 'Set a custom field with call data' },
    // HubSpot actions
    { value: 'hubspot_log_call', label: 'Log to HubSpot', description: 'Create call engagement in HubSpot' },
    { value: 'hubspot_create_contact', label: 'Create HubSpot Contact', description: 'Create contact if not found' },
    { value: 'hubspot_update_contact', label: 'Update HubSpot Contact', description: 'Update contact properties based on call' },
    { value: 'hubspot_upsert_contact', label: 'Upsert HubSpot Contact', description: 'Find or create contact with call data' },
    { value: 'hubspot_add_call_note', label: 'Add Call Note (HubSpot)', description: 'Push call summary and transcript as note' },
    { value: 'hubspot_add_tags', label: 'Auto-Tag Contact (HubSpot)', description: 'Apply tags based on call outcome' },
    { value: 'hubspot_update_pipeline', label: 'Update Pipeline (HubSpot)', description: 'Create/move deal in pipeline' },
    { value: 'hubspot_lead_score', label: 'Lead Score (HubSpot)', description: 'Calculate and store lead score' },
    { value: 'hubspot_book_appointment', label: 'Book Meeting (HubSpot)', description: 'Schedule a meeting for the contact' },
    { value: 'hubspot_cancel_appointment', label: 'Cancel Meeting (HubSpot)', description: 'Cancel an existing meeting' },
    { value: 'hubspot_trigger_workflow', label: 'Trigger HubSpot Workflow', description: 'Enroll contact in a HubSpot workflow' },
    { value: 'hubspot_update_contact_field', label: 'Update Contact Property (HubSpot)', description: 'Set a contact property with call data' },
    // Google Calendar actions
    { value: 'gcal_book_event', label: 'Book Event (Google Calendar)', description: 'Find next available slot and create event' },
    { value: 'gcal_cancel_event', label: 'Cancel Event (Google Calendar)', description: 'Cancel a previously booked event' },
    { value: 'gcal_check_availability', label: 'Check Availability (Google Calendar)', description: 'Check free/busy slots on calendar' },
    // Messaging actions
    { value: 'send_sms', label: 'Send SMS', description: 'Send an SMS to the caller after the call' },
    { value: 'send_email', label: 'Send Email', description: 'Send an email notification after the call' },
    { value: 'send_slack', label: 'Send Slack Notification', description: 'Post a call notification to Slack' },
    // Calendly actions
    { value: 'calendly_check_availability', label: 'Check Availability (Calendly)', description: 'Check free/busy slots on Calendly' },
    { value: 'calendly_create_booking_link', label: 'Create Booking Link (Calendly)', description: 'Generate a one-time scheduling link' },
    { value: 'calendly_cancel_event', label: 'Cancel Event (Calendly)', description: 'Cancel a scheduled Calendly event' },
];

export const conditionFields = [
    { value: 'duration_seconds', label: 'Call Duration (seconds)' },
    { value: 'status', label: 'Call Status' },
    { value: 'sentiment', label: 'Sentiment' },
    { value: 'direction', label: 'Direction' },
    { value: 'from_number', label: 'From Number' },
    { value: 'to_number', label: 'To Number' },
    { value: 'cost_cents', label: 'Cost (cents)' },
    { value: 'agent_name', label: 'Agent Name' },
    { value: 'summary', label: 'Call Summary' },
    { value: 'transcript', label: 'Transcript' },
];

export const conditionOperators = [
    { value: '==', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '<', label: 'less than' },
    { value: '>=', label: 'greater or equal' },
    { value: '<=', label: 'less or equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
];
