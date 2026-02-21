-- ============================================
-- ADD PER-CLIENT VOICE PROVIDER API KEYS
-- ============================================
-- Nullable columns: NULL means "use agency key" (fallback)
-- Follows Retell best practice of per-client workspaces

ALTER TABLE clients ADD COLUMN IF NOT EXISTS retell_api_key TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vapi_api_key TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bland_api_key TEXT;
