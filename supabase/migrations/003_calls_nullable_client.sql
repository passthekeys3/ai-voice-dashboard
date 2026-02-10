-- Make client_id nullable in calls table
-- This allows syncing calls for agents that aren't assigned to a client yet

ALTER TABLE calls ALTER COLUMN client_id DROP NOT NULL;
