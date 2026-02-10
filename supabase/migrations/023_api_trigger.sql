-- API Trigger Log
-- Logs all trigger attempts from the generic /api/trigger-call endpoint
-- Used by Make.com, n8n, and other automation platforms

CREATE TABLE api_trigger_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    agent_id UUID REFERENCES agents(id),
    status TEXT NOT NULL, -- 'initiated', 'scheduled', 'failed'
    scheduled_call_id UUID REFERENCES scheduled_calls(id),
    call_id TEXT,
    error_message TEXT,
    request_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_trigger_log_agency ON api_trigger_log(agency_id, created_at DESC);

-- Enable RLS (service role key bypasses RLS, so this is for defense-in-depth)
ALTER TABLE api_trigger_log ENABLE ROW LEVEL SECURITY;
