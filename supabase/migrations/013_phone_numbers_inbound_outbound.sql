-- Phone Numbers: Add separate inbound/outbound agent assignments
-- Migration 013

-- Add inbound_agent_id and outbound_agent_id columns
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS inbound_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS outbound_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Migrate existing agent_id to inbound_agent_id (assuming single agent was for inbound)
UPDATE phone_numbers SET inbound_agent_id = agent_id WHERE agent_id IS NOT NULL;

-- Drop old agent_id column (optional - can keep for backwards compatibility)
-- ALTER TABLE phone_numbers DROP COLUMN agent_id;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_phone_numbers_inbound_agent ON phone_numbers(inbound_agent_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_outbound_agent ON phone_numbers(outbound_agent_id);

-- Add unique constraint on external_id + agency_id to prevent duplicates per agency
-- First drop the existing unique index if it exists
DROP INDEX IF EXISTS idx_phone_numbers_external;

-- Create a proper unique constraint scoped to agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_external_agency
    ON phone_numbers(external_id, agency_id)
    WHERE external_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN phone_numbers.inbound_agent_id IS 'Agent that handles inbound calls to this number';
COMMENT ON COLUMN phone_numbers.outbound_agent_id IS 'Agent that uses this number for outbound calls';
