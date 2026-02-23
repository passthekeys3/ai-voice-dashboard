-- Add vapi_public_key column for Vapi Web SDK (web call / test call support)
-- The public key is separate from the private vapi_api_key and is safe to expose client-side.
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS vapi_public_key TEXT;
