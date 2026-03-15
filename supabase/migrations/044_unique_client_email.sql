-- Prevent duplicate client emails within the same agency.
-- This avoids billing confusion, invitation conflicts, and CRM lookup ambiguity.

-- Deduplicate any existing violations first (keep the oldest record per agency+email pair)
DELETE FROM clients
WHERE id NOT IN (
    SELECT DISTINCT ON (agency_id, lower(email)) id
    FROM clients
    WHERE email IS NOT NULL
    ORDER BY agency_id, lower(email), created_at ASC
)
AND email IS NOT NULL;

-- Add unique constraint (case-insensitive via lower())
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_agency_email_unique
    ON clients (agency_id, lower(email))
    WHERE email IS NOT NULL;

COMMENT ON INDEX idx_clients_agency_email_unique IS 'Prevent duplicate client emails within the same agency (case-insensitive)';
