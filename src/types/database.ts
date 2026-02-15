// Database Types - Auto-generated from Supabase schema

export type UserRole = 'agency_admin' | 'agency_member' | 'client_admin' | 'client_member';
export type VoiceProvider = 'retell' | 'vapi' | 'bland';
export type CallStatus = 'completed' | 'failed' | 'in_progress' | 'queued';
export type BillingType = 'subscription' | 'per_minute' | 'one_time';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';

export interface Agency {
    id: string;
    name: string;
    slug?: string;
    branding?: AgencyBranding;
    integrations?: AgencyIntegrations;
    default_client_permissions?: ClientPermissions;
    retell_api_key?: string;
    vapi_api_key?: string;
    bland_api_key?: string;
    stripe_customer_id?: string;
    // Custom domain support
    custom_domain?: string;
    domain_verified?: boolean;
    domain_verification_token?: string;
    domain_verified_at?: string;
    // Subscription fields
    subscription_status?: SubscriptionStatus;
    subscription_id?: string;
    subscription_price_id?: string;
    subscription_current_period_start?: string;
    subscription_current_period_end?: string;
    subscription_cancel_at_period_end?: boolean;
    // Stripe Connect (agency bills their own clients)
    stripe_connect_account_id?: string;
    stripe_connect_onboarding_complete?: boolean;
    stripe_connect_charges_enabled?: boolean;
    stripe_connect_payouts_enabled?: boolean;
    platform_fee_percent?: number;
    // Calling window (also in integrations.ghl, this is the top-level default)
    calling_window?: CallingWindowConfig;
    created_at: string;
    updated_at: string;
}

// Permissions that control what clients can see and do
export interface ClientPermissions {
    show_costs: boolean;
    show_transcripts: boolean;
    show_analytics: boolean;
    allow_playback: boolean;
    can_edit_agents: boolean;
    can_create_agents: boolean;
    can_export_calls: boolean;
}

// Default permissions for new clients
export const DEFAULT_CLIENT_PERMISSIONS: ClientPermissions = {
    show_costs: false,
    show_transcripts: true,
    show_analytics: true,
    allow_playback: true,
    can_edit_agents: false,
    can_create_agents: false,
    can_export_calls: false,
};

export interface AgencyBranding {
    // Logo & Icons
    logo_url?: string;           // Main logo (200x50px recommended)
    favicon_url?: string;        // Favicon (32x32px)

    // Colors
    primary_color?: string;      // Sidebar/main brand color (default: #0f172a)
    secondary_color?: string;    // Secondary UI color (default: #1e293b)
    accent_color?: string;       // Accent/highlight color (default: #3b82f6)

    // Text & Identity
    company_name?: string;       // Display name for the agency
    tagline?: string;            // Optional tagline/subtitle

    // Contact
    website_url?: string;        // Company website
    support_email?: string;      // Support contact email
    support_phone?: string;      // Support phone (optional)

    // Customization
    footer_text?: string;        // Custom footer text
    login_message?: string;      // Custom message on login page
}

// Default branding values
export const DEFAULT_AGENCY_BRANDING: Required<Pick<AgencyBranding, 'primary_color' | 'secondary_color' | 'accent_color'>> = {
    primary_color: '#0f172a',
    secondary_color: '#1e293b',
    accent_color: '#3b82f6',
};

export interface CallingWindowConfig {
    enabled: boolean;
    start_hour: number;        // 0-23, default 9
    end_hour: number;          // 0-23, default 20 (8pm)
    days_of_week: number[];    // 0=Sun, 1=Mon...6=Sat, default [1,2,3,4,5]
    timezone_override?: string; // Force a specific timezone instead of auto-detect
}

export const DEFAULT_CALLING_WINDOW: CallingWindowConfig = {
    enabled: false,
    start_hour: 9,
    end_hour: 20,
    days_of_week: [1, 2, 3, 4, 5],
};

export interface GHLTriggerConfig {
    webhook_secret: string;
    enabled: boolean;
    default_agent_id?: string;
}

export interface HubSpotTriggerConfig {
    webhook_secret: string;
    enabled: boolean;
    default_agent_id?: string;
}

export interface AgencyIntegrations {
    ghl?: {
        // API Key auth (manual fallback)
        api_key?: string;
        location_id?: string;
        // OAuth auth
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        oauth_location_id?: string;
        // Shared
        enabled?: boolean;
        auth_method?: 'api_key' | 'oauth';
        calling_window?: CallingWindowConfig;
        trigger_config?: GHLTriggerConfig;
    };
    hubspot?: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        portal_id?: string;
        enabled?: boolean;
        trigger_config?: HubSpotTriggerConfig;
    };
    google_calendar?: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        enabled?: boolean;
        default_calendar_id?: string;
        default_calendar_name?: string;
    };
    api?: {
        api_key?: string;       // pdy_sk_<64 hex chars>
        enabled?: boolean;
        default_agent_id?: string;
    };
    slack?: {
        webhook_url?: string;
        enabled?: boolean;
        channel_name?: string;  // Display only, for user reference
    };
    calendly?: {
        api_token?: string;
        enabled?: boolean;
        user_uri?: string;                  // Auto-populated on connect: https://api.calendly.com/users/XXXXX
        default_event_type_uri?: string;    // Selected event type for booking
    };
}

export interface Client {
    id: string;
    agency_id: string;
    name: string;
    email: string;
    slug: string;
    branding?: ClientBranding;
    permissions?: ClientPermissions; // Per-client overrides (null = use agency defaults)
    stripe_customer_id?: string;
    // Billing configuration
    billing_type?: BillingType;
    billing_amount_cents?: number; // Monthly fee, per-minute rate, or one-time fee in cents
    stripe_subscription_id?: string;
    next_billing_date?: string;
    ai_call_analysis?: boolean; // Per-client opt-in for AI call analysis ($0.01/call)
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ClientBranding {
    logo_url?: string;
    primary_color?: string;
    company_name?: string;
}

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    agency_id: string;
    client_id?: string;
    role: UserRole;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
}

export interface Agent {
    id: string;
    agency_id: string;
    client_id?: string;
    name: string;
    provider: VoiceProvider;
    external_id: string;
    config: AgentConfig;
    is_active: boolean;
    // Widget configuration
    widget_enabled?: boolean;
    widget_key?: string;
    widget_config?: WidgetConfig;
    created_at: string;
    updated_at: string;
}

export interface WidgetConfig {
    color?: string;                // Primary color (hex), defaults to agency branding
    position?: 'left' | 'right';  // Button position, defaults to 'right'
    greeting?: string;             // Text shown on hover, e.g. "Talk to our AI assistant"
    avatar_url?: string;           // Custom avatar for the button
}

export interface AgentConfig {
    // Common fields
    prompt?: string;
    voice_id?: string;
    voice_name?: string;
    language?: string;
    knowledge_base_id?: string;
    webhook_url?: string;
    metadata?: Record<string, unknown>;
    // Retell-specific fields
    agent_name?: string;
    llm_websocket_url?: string;
    responsiveness?: number;
    interruption_sensitivity?: number;
    ambient_sound?: string;
    llm_id?: string;
    llm_prompt?: string;
    response_engine?: Record<string, unknown>;
    // Allow additional provider-specific fields
    [key: string]: unknown;
}

export interface Call {
    id: string;
    agent_id: string;
    client_id: string;
    external_id: string;
    provider: VoiceProvider;
    status: CallStatus;
    direction: 'inbound' | 'outbound';
    duration_seconds: number;
    cost_cents: number;
    from_number?: string;
    to_number?: string;
    transcript?: string;
    audio_url?: string;
    summary?: string;
    sentiment?: string;
    metadata?: Record<string, unknown>;
    lead_timezone?: string;
    started_at: string;
    ended_at?: string;
    created_at: string;
    // A/B Testing
    experiment_id?: string;
    variant_id?: string;
    // AI Insights
    topics?: string[];
    objections?: string[];
    conversion_score?: number;
    call_score?: number;
    insights?: CallInsights;
    // Joined data
    agent?: { name: string };
}

export interface CallInsights {
    keywords?: string[];
    action_items?: string[];
    follow_up_needed?: boolean;
    customer_intent?: string;
    engagement_score?: number;
}

export interface Usage {
    id: string;
    client_id: string;
    period_start: string;
    period_end: string;
    total_calls: number;
    total_minutes: number;
    total_cost_cents: number;
    created_at: string;
}

// API Response Types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

// Analytics Types
export interface AnalyticsOverview {
    total_calls: number;
    total_minutes: number;
    total_cost: number;
    success_rate: number;
    avg_call_duration: number;
    calls_by_day: { date: string; count: number }[];
    calls_by_agent: { agent_id: string; agent_name: string; count: number }[];
}

// Auth Types
export interface AuthUser {
    id: string;
    email: string;
    profile: Profile;
    agency: Agency;
    client?: Client;
}

// API Trigger Log Types
export type ApiTriggerStatus = 'initiated' | 'scheduled' | 'failed';

export interface ApiTriggerLog {
    id: string;
    agency_id: string;
    phone_number: string;
    contact_name?: string;
    agent_id?: string;
    status: ApiTriggerStatus;
    scheduled_call_id?: string;
    call_id?: string;
    error_message?: string;
    request_payload?: Record<string, unknown>;
    created_at: string;
    // Joined data
    agent?: { name: string };
}

// Workflow Types
export type WorkflowTrigger = 'call_ended' | 'call_started' | 'inbound_call_started' | 'inbound_call_ended';
export type WorkflowActionType =
    | 'webhook'
    | 'ghl_log_call' | 'ghl_create_contact' | 'ghl_add_tags' | 'ghl_update_pipeline' | 'ghl_lead_score'
    | 'ghl_book_appointment' | 'ghl_cancel_appointment'
    | 'ghl_upsert_contact' | 'ghl_add_call_note' | 'ghl_trigger_workflow' | 'ghl_update_contact_field'
    | 'hubspot_log_call' | 'hubspot_create_contact' | 'hubspot_update_contact'
    | 'hubspot_add_tags' | 'hubspot_update_pipeline' | 'hubspot_lead_score'
    | 'hubspot_book_appointment' | 'hubspot_cancel_appointment'
    | 'hubspot_upsert_contact' | 'hubspot_add_call_note' | 'hubspot_trigger_workflow' | 'hubspot_update_contact_field'
    | 'gcal_book_event' | 'gcal_cancel_event' | 'gcal_check_availability'
    // Calendly integrations
    | 'calendly_check_availability' | 'calendly_create_booking_link' | 'calendly_cancel_event'
    // Messaging & notifications
    | 'send_sms' | 'send_email' | 'send_slack';

export interface Workflow {
    id: string;
    agency_id: string;
    agent_id?: string | null;
    name: string;
    description?: string;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Joined data
    agent?: { name: string };
}

export interface WorkflowCondition {
    field: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains';
    value: string | number | boolean;
}

export interface WorkflowAction {
    type: WorkflowActionType;
    config: Record<string, unknown>;
}

export interface WorkflowWebhookConfig {
    url: string;
    method?: 'POST' | 'GET';
    headers?: Record<string, string>;
}

export interface WorkflowGHLConfig {
    tags?: string[];
}

export interface WorkflowSMSConfig {
    to: string;              // '{{from_number}}' or explicit number
    message: string;         // template with {{variables}}
}

export interface WorkflowEmailConfig {
    to: string;              // email address or template variable
    subject: string;         // template with {{variables}}
    body?: string;           // HTML or plain text with {{variables}}
}

export interface WorkflowSlackConfig {
    webhook_url: string;
    channel?: string;
}

// Workflow Execution Log Types
export type WorkflowExecutionStatus = 'running' | 'completed' | 'partial_failure' | 'failed' | 'skipped';

export interface ActionResult {
    action_index: number;
    action_type: string;
    status: 'success' | 'failed' | 'skipped';
    started_at: string;
    completed_at: string;
    duration_ms: number;
    error?: string;
    attempts?: number;
}

export interface WorkflowExecutionLog {
    id: string;
    agency_id: string;
    workflow_id: string;
    call_id: string;
    trigger: string;
    status: WorkflowExecutionStatus;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    actions_total: number;
    actions_succeeded: number;
    actions_failed: number;
    action_results: ActionResult[];
    error_summary?: string;
    created_at: string;
    // Joined data
    workflow?: { name: string };
}

// A/B Testing Types
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type ExperimentGoal = 'conversion' | 'duration' | 'sentiment';

export interface Experiment {
    id: string;
    agency_id: string;
    agent_id: string;
    name: string;
    description?: string;
    status: ExperimentStatus;
    goal: ExperimentGoal;
    start_date?: string;
    end_date?: string;
    winner_variant_id?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    agent?: { name: string };
    variants?: ExperimentVariant[];
}

export interface ExperimentVariant {
    id: string;
    experiment_id: string;
    name: string;
    prompt: string;
    traffic_weight: number;
    is_control: boolean;
    created_at: string;
    updated_at: string;
    // Computed metrics
    call_count?: number;
    avg_duration?: number;
    avg_sentiment?: number;
    conversion_rate?: number;
}

// Scheduled Calls Types
export type ScheduledCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type TriggerSource = 'manual' | 'ghl_trigger' | 'hubspot_trigger' | 'api_trigger' | 'workflow';

export interface ScheduledCall {
    id: string;
    agency_id: string;
    agent_id: string;
    to_number: string;
    contact_name?: string;
    scheduled_at: string;
    status: ScheduledCallStatus;
    notes?: string;
    metadata?: Record<string, unknown>;
    external_call_id?: string;
    completed_at?: string;
    error_message?: string;
    retry_count: number;
    max_retries: number;
    created_by?: string;
    // Timezone intelligence
    lead_timezone?: string;
    original_scheduled_at?: string;
    timezone_delayed?: boolean;
    trigger_source?: TriggerSource;
    ghl_contact_id?: string;
    hubspot_contact_id?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    agent?: { name: string; external_id?: string };
}

// Phone Number Types
export type PhoneNumberStatus = 'active' | 'released';

export interface PhoneNumber {
    id: string;
    agency_id: string;
    external_id?: string;
    phone_number: string;
    nickname?: string;
    provider: string;
    status: PhoneNumberStatus;
    agent_id?: string; // Deprecated - use inbound_agent_id/outbound_agent_id
    inbound_agent_id?: string;
    outbound_agent_id?: string;
    monthly_cost_cents: number;
    purchased_at: string;
    created_at: string;
    updated_at: string;
    // Joined data
    agent?: { id: string; name: string }; // Deprecated
    inbound_agent?: { id: string; name: string };
    outbound_agent?: { id: string; name: string };
}

// GHL Trigger Log Types
export type GHLTriggerStatus = 'received' | 'initiated' | 'scheduled' | 'failed';

export interface GHLTriggerLog {
    id: string;
    agency_id: string;
    ghl_contact_id?: string;
    phone_number: string;
    contact_name?: string;
    agent_id?: string;
    status: GHLTriggerStatus;
    scheduled_call_id?: string;
    call_id?: string;
    lead_timezone?: string;
    timezone_delayed?: boolean;
    scheduled_at?: string;
    error_message?: string;
    request_payload?: Record<string, unknown>;
    created_at: string;
    // Joined data
    agent?: { name: string };
}

// HubSpot Trigger Log Types
export type HubSpotTriggerStatus = 'received' | 'initiated' | 'scheduled' | 'failed';

export interface HubSpotTriggerLog {
    id: string;
    agency_id: string;
    hubspot_contact_id?: string;
    phone_number: string;
    contact_name?: string;
    agent_id?: string;
    status: HubSpotTriggerStatus;
    scheduled_call_id?: string;
    call_id?: string;
    lead_timezone?: string;
    timezone_delayed?: boolean;
    scheduled_at?: string;
    error_message?: string;
    request_payload?: Record<string, unknown>;
    created_at: string;
    // Joined data
    agent?: { name: string };
}
