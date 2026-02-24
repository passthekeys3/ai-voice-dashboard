-- Migration: Per-client integration configuration
-- Adds integrations JSONB column to clients table and can_manage_integrations permission

-- Per-client integration overrides (NULL = use agency defaults)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS integrations JSONB;

-- Backfill can_manage_integrations into existing agency default_client_permissions
UPDATE agencies
SET default_client_permissions = default_client_permissions || '{"can_manage_integrations": false}'::jsonb
WHERE default_client_permissions IS NOT NULL
  AND NOT (default_client_permissions ? 'can_manage_integrations');

-- Backfill can_manage_integrations into existing client permission overrides
UPDATE clients
SET permissions = permissions || '{"can_manage_integrations": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'can_manage_integrations');
