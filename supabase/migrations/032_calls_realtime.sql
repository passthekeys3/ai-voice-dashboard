-- Enable Supabase Realtime on calls table for live transcript updates.
-- LiveTranscript.tsx subscribes to postgres_changes on this table
-- to receive instant updates when the webhook handler writes transcript data.
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
