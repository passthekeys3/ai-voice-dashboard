-- Per-client opt-in for AI call analysis
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_call_analysis BOOLEAN DEFAULT false;

-- Track AI analysis usage per agency (simple counter, for manual invoicing)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS ai_analysis_count INTEGER DEFAULT 0;

-- Atomic increment function for AI analysis counter (safe for concurrent webhooks)
CREATE OR REPLACE FUNCTION increment_ai_analysis_count(agency_id_input UUID)
RETURNS void AS $$
BEGIN
    UPDATE agencies
    SET ai_analysis_count = COALESCE(ai_analysis_count, 0) + 1,
        updated_at = NOW()
    WHERE id = agency_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
