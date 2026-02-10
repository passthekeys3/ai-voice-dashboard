-- Scheduled Calls Schema
-- Migration 010

-- Scheduled calls table
CREATE TABLE IF NOT EXISTS scheduled_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    to_number TEXT NOT NULL,
    contact_name TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed, cancelled
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    external_call_id TEXT,  -- Retell call ID when initiated
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 2,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_agency ON scheduled_calls(agency_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_agent ON scheduled_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduled_at ON scheduled_calls(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_pending ON scheduled_calls(scheduled_at) 
    WHERE status = 'pending';

-- Enable RLS
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agency members can view scheduled calls"
    ON scheduled_calls FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Agency admins can manage scheduled calls"
    ON scheduled_calls FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- Comments
COMMENT ON TABLE scheduled_calls IS 'Calls scheduled for future execution';
COMMENT ON COLUMN scheduled_calls.status IS 'Call status: pending, in_progress, completed, failed, cancelled';
COMMENT ON COLUMN scheduled_calls.external_call_id IS 'Retell call ID after call is initiated';
