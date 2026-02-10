-- Migration: Performance Indexes
-- Description: Add missing indexes for common query patterns and constraints

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Index for filtering calls by client_id (common in calls page, analytics, exports)
CREATE INDEX IF NOT EXISTS idx_calls_client_id ON calls(client_id);

-- Index for filtering calls by status (common filter in UI)
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- Composite index for scheduled calls cron job queries
-- Optimizes: WHERE status = 'pending' AND scheduled_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status_scheduled_at
ON scheduled_calls(status, scheduled_at);

-- Index for experiment status filtering
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- Composite index for multi-tenant call filtering
CREATE INDEX IF NOT EXISTS idx_calls_agency_client
ON calls(agency_id, client_id);

-- Index for phone number lookups by agent
CREATE INDEX IF NOT EXISTS idx_phone_numbers_inbound_agent
ON phone_numbers(inbound_agent_id) WHERE inbound_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_outbound_agent
ON phone_numbers(outbound_agent_id) WHERE outbound_agent_id IS NOT NULL;

-- =====================================================
-- DATA INTEGRITY CONSTRAINTS
-- =====================================================

-- Ensure max_retries is non-negative
ALTER TABLE scheduled_calls
ADD CONSTRAINT chk_scheduled_calls_max_retries_non_negative
CHECK (max_retries >= 0);

-- Ensure phone number costs are non-negative
ALTER TABLE phone_numbers
ADD CONSTRAINT chk_phone_numbers_monthly_cost_non_negative
CHECK (monthly_cost_cents >= 0);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON INDEX idx_calls_client_id IS 'Optimizes client-specific call queries';
COMMENT ON INDEX idx_calls_status IS 'Optimizes status filtering in calls list';
COMMENT ON INDEX idx_scheduled_calls_status_scheduled_at IS 'Optimizes cron job queries for pending scheduled calls';
COMMENT ON INDEX idx_experiments_status IS 'Optimizes experiment list filtering by status';
COMMENT ON INDEX idx_calls_agency_client IS 'Optimizes multi-tenant call filtering';
