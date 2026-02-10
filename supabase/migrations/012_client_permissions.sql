-- Add client permissions
-- Agency-wide defaults + per-client overrides

-- Add default_client_permissions to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS default_client_permissions JSONB DEFAULT '{
  "show_costs": false,
  "show_transcripts": true,
  "show_analytics": true,
  "allow_playback": true
}'::jsonb;

-- Add permissions override to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN agencies.default_client_permissions IS 'Default permissions for all clients. Individual clients can override these.';
COMMENT ON COLUMN clients.permissions IS 'Per-client permission overrides. NULL means use agency defaults.';
