-- ============================================
-- ADD BLAND.AI AS THIRD VOICE PROVIDER
-- ============================================

-- Add bland_api_key column to agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS bland_api_key TEXT;

-- Update provider CHECK constraints on agents table
-- Postgres auto-names inline CHECK constraints as {table}_{column}_check
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_provider_check;
ALTER TABLE agents ADD CONSTRAINT agents_provider_check
    CHECK (provider IN ('retell', 'vapi', 'bland'));

-- Update provider CHECK constraints on calls table
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_provider_check;
ALTER TABLE calls ADD CONSTRAINT calls_provider_check
    CHECK (provider IN ('retell', 'vapi', 'bland'));
