-- Call Insights Schema
-- Migration 009

-- Add insights fields to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS topics TEXT[];
ALTER TABLE calls ADD COLUMN IF NOT EXISTS objections TEXT[];
ALTER TABLE calls ADD COLUMN IF NOT EXISTS conversion_score INT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '{}';

-- Create index for faster topic searches
CREATE INDEX IF NOT EXISTS idx_calls_topics ON calls USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_calls_objections ON calls USING GIN (objections);
CREATE INDEX IF NOT EXISTS idx_calls_conversion_score ON calls(conversion_score) WHERE conversion_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON calls(sentiment) WHERE sentiment IS NOT NULL;

-- Comments
COMMENT ON COLUMN calls.topics IS 'Array of topics discussed in the call';
COMMENT ON COLUMN calls.objections IS 'Array of customer objections identified';
COMMENT ON COLUMN calls.conversion_score IS 'Lead quality score 0-100';
COMMENT ON COLUMN calls.insights IS 'Additional AI-generated insights JSON';
