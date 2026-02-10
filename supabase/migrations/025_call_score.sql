-- Add call_score column for composite call quality scoring (0-100)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_score INTEGER;

-- Partial index for efficient filtering/sorting by score
CREATE INDEX IF NOT EXISTS idx_calls_call_score ON calls(call_score) WHERE call_score IS NOT NULL;
