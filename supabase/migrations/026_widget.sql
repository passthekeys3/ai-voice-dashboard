-- Embeddable voice widget support
-- Adds widget configuration fields to the agents table

ALTER TABLE agents ADD COLUMN IF NOT EXISTS widget_enabled BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS widget_key TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS widget_config JSONB DEFAULT '{}';

-- Index for quick widget lookups by agent ID where widget is enabled
CREATE INDEX IF NOT EXISTS idx_agents_widget_enabled ON agents(id) WHERE widget_enabled = true;
