-- Backfill new granular permission keys into existing JSONB permission objects.
-- New keys: can_edit_agents, can_create_agents, can_export_calls (all default false).
-- This ensures backward compatibility — stored JSON missing newer fields gets safe defaults.

-- Backfill agency default_client_permissions
UPDATE agencies
SET default_client_permissions = default_client_permissions ||
    '{"can_edit_agents": false, "can_create_agents": false, "can_export_calls": false}'::jsonb
WHERE default_client_permissions IS NOT NULL
  AND NOT (default_client_permissions ? 'can_edit_agents');

-- Backfill client-specific permission overrides
UPDATE clients
SET permissions = permissions ||
    '{"can_edit_agents": false, "can_create_agents": false, "can_export_calls": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'can_edit_agents');
