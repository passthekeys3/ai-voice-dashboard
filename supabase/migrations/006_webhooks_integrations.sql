-- Webhook and Integrations Schema Updates
-- Migration 006

-- Add webhook_url to agents for post-call automation
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Add integrations column to agencies for CRM connections
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS integrations JSONB DEFAULT '{}';

-- integrations structure:
-- {
--   "ghl": { "api_key": "...", "location_id": "...", "enabled": true },
--   "hubspot": { "access_token": "...", "refresh_token": "...", "enabled": true }
-- }

COMMENT ON COLUMN agents.webhook_url IS 'URL to forward call data after call ends';
COMMENT ON COLUMN agencies.integrations IS 'CRM integration settings (GHL, HubSpot, etc.)';
