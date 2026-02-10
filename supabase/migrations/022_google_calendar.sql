-- Google Calendar Integration Support
-- Migration 022
--
-- No schema changes needed. Google Calendar credentials and config are stored
-- in the existing agencies.integrations JSONB column under the 'google_calendar' key.
--
-- Structure:
-- {
--   "google_calendar": {
--     "access_token": "ya29...",
--     "refresh_token": "1//...",
--     "expires_at": 1700000000000,
--     "enabled": true,
--     "default_calendar_id": "primary",
--     "default_calendar_name": "My Calendar"
--   }
-- }

COMMENT ON COLUMN agencies.integrations IS 'Integration settings: GHL, HubSpot, Google Calendar';
