-- Migration: Timezone Intelligence & Calling Windows
-- Adds timezone detection storage and calling window configuration for
-- Sympana-level GHL integration with timezone-aware outbound calling.

-- ============================================
-- 1. Scheduled Calls: Timezone columns
-- ============================================

-- Lead timezone detected from phone area code
ALTER TABLE scheduled_calls
ADD COLUMN IF NOT EXISTS lead_timezone TEXT;

-- Original scheduled time before timezone adjustment
ALTER TABLE scheduled_calls
ADD COLUMN IF NOT EXISTS original_scheduled_at TIMESTAMPTZ;

-- Whether this call was delayed due to calling window enforcement
ALTER TABLE scheduled_calls
ADD COLUMN IF NOT EXISTS timezone_delayed BOOLEAN DEFAULT FALSE;

-- Source of the trigger (manual, ghl_trigger, workflow)
ALTER TABLE scheduled_calls
ADD COLUMN IF NOT EXISTS trigger_source TEXT DEFAULT 'manual';

-- GHL contact ID if triggered from GHL
ALTER TABLE scheduled_calls
ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;

-- ============================================
-- 2. Calls: Timezone for analytics
-- ============================================

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS lead_timezone TEXT;

-- ============================================
-- 3. Agencies: Calling window configuration
-- ============================================

ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS calling_window JSONB DEFAULT '{"enabled": false, "start_hour": 9, "end_hour": 20, "days_of_week": [1,2,3,4,5]}';

-- ============================================
-- 4. Indexes
-- ============================================

-- Index for timezone-delayed calls that need processing
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_timezone_delayed
ON scheduled_calls(scheduled_at, status)
WHERE timezone_delayed = true AND status = 'pending';

-- Index for looking up agencies by GHL location ID (for trigger webhook)
CREATE INDEX IF NOT EXISTS idx_agencies_ghl_location
ON agencies USING GIN ((integrations->'ghl'));

-- ============================================
-- 5. Comments
-- ============================================

COMMENT ON COLUMN scheduled_calls.lead_timezone IS 'IANA timezone detected from lead phone area code';
COMMENT ON COLUMN scheduled_calls.original_scheduled_at IS 'Original requested time before timezone/calling window adjustment';
COMMENT ON COLUMN scheduled_calls.timezone_delayed IS 'Whether this call was auto-delayed to comply with calling window';
COMMENT ON COLUMN scheduled_calls.trigger_source IS 'How this call was triggered: manual, ghl_trigger, workflow';
COMMENT ON COLUMN scheduled_calls.ghl_contact_id IS 'GoHighLevel contact ID if call was triggered from GHL workflow';
COMMENT ON COLUMN calls.lead_timezone IS 'IANA timezone of the lead for analytics';
COMMENT ON COLUMN agencies.calling_window IS 'Default calling window: {enabled, start_hour, end_hour, days_of_week}';
