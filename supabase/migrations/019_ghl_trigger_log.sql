-- Migration: GHL Trigger Activity Log
-- Tracks all inbound webhook triggers from GoHighLevel for monitoring and debugging.

-- ============================================
-- 1. GHL Trigger Log Table
-- ============================================

CREATE TABLE IF NOT EXISTS ghl_trigger_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    ghl_contact_id TEXT,
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'received',  -- received, initiated, scheduled, failed
    scheduled_call_id UUID REFERENCES scheduled_calls(id) ON DELETE SET NULL,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    lead_timezone TEXT,
    timezone_delayed BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMPTZ,
    error_message TEXT,
    request_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ghl_trigger_log_agency
ON ghl_trigger_log(agency_id);

CREATE INDEX IF NOT EXISTS idx_ghl_trigger_log_created
ON ghl_trigger_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghl_trigger_log_status
ON ghl_trigger_log(agency_id, status);

-- ============================================
-- 3. Row Level Security
-- ============================================

ALTER TABLE ghl_trigger_log ENABLE ROW LEVEL SECURITY;

-- Agency members can view their trigger logs
CREATE POLICY "Agency members can view trigger logs"
    ON ghl_trigger_log FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

-- Service role can insert (webhooks bypass RLS via service client)
-- No INSERT policy needed since trigger webhook uses createServiceClient()

-- ============================================
-- 4. Comments
-- ============================================

COMMENT ON TABLE ghl_trigger_log IS 'Audit log of all GHL webhook triggers received';
COMMENT ON COLUMN ghl_trigger_log.status IS 'Trigger status: received, initiated, scheduled, failed';
COMMENT ON COLUMN ghl_trigger_log.timezone_delayed IS 'Whether the call was delayed due to calling window enforcement';
