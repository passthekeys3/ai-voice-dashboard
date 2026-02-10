-- Phone Numbers Schema
-- Migration 011

-- Phone numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    external_id TEXT,  -- Retell phone number ID
    phone_number TEXT NOT NULL,
    nickname TEXT,
    provider TEXT DEFAULT 'retell',
    status TEXT NOT NULL DEFAULT 'active',  -- active, released
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    monthly_cost_cents INT DEFAULT 0,
    purchased_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phone_numbers_agency ON phone_numbers(agency_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent ON phone_numbers(agent_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON phone_numbers(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_external ON phone_numbers(external_id) WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agency members can view phone numbers"
    ON phone_numbers FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Agency admins can manage phone numbers"
    ON phone_numbers FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- Comments
COMMENT ON TABLE phone_numbers IS 'Phone numbers purchased through the platform';
COMMENT ON COLUMN phone_numbers.external_id IS 'Provider phone number ID (e.g., Retell)';
COMMENT ON COLUMN phone_numbers.status IS 'active or released';
