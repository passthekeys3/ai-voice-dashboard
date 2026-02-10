-- Migration: HubSpot Trigger Activity Log
-- Tracks all inbound webhook triggers from HubSpot for monitoring and debugging.

-- ============================================
-- 1. HubSpot Trigger Log Table
-- ============================================

CREATE TABLE IF NOT EXISTS hubspot_trigger_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    hubspot_contact_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_hubspot_trigger_log_agency
ON hubspot_trigger_log(agency_id);

CREATE INDEX IF NOT EXISTS idx_hubspot_trigger_log_created
ON hubspot_trigger_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hubspot_trigger_log_status
ON hubspot_trigger_log(agency_id, status);

-- ============================================
-- 3. Row Level Security
-- ============================================

ALTER TABLE hubspot_trigger_log ENABLE ROW LEVEL SECURITY;

-- Agency members can view their trigger logs
CREATE POLICY "Agency members can view hubspot trigger logs"
    ON hubspot_trigger_log FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

-- Service role can insert (webhooks bypass RLS via service client)
-- No INSERT policy needed since trigger webhook uses createServiceClient()

-- ============================================
-- 4. Extend scheduled_calls for HubSpot
-- ============================================

ALTER TABLE scheduled_calls ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT;

-- ============================================
-- 5. Index for HubSpot portal lookup
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agencies_hubspot_portal
ON agencies USING GIN ((integrations->'hubspot'));

-- ============================================
-- 6. Comments
-- ============================================

COMMENT ON TABLE hubspot_trigger_log IS 'Audit log of all HubSpot webhook triggers received';
COMMENT ON COLUMN hubspot_trigger_log.status IS 'Trigger status: received, initiated, scheduled, failed';
COMMENT ON COLUMN hubspot_trigger_log.timezone_delayed IS 'Whether the call was delayed due to calling window enforcement';
