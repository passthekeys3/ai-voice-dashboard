-- ElevenLabs as a fourth voice provider: per-agency and per-client API keys
-- (stored encrypted by the app, like the other provider keys).
-- Applied by hand in April 2026; recorded here so new databases match.

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT;
