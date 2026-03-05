-- Beta trial support: promo-code-based extended trial with full feature access
-- Beta users get Agency-tier access until a fixed end date (e.g., 2026-04-30)

ALTER TABLE agencies
    ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS beta_ends_at TIMESTAMPTZ;

-- Index for cron queries that need to find beta users approaching expiry
CREATE INDEX IF NOT EXISTS idx_agencies_beta
    ON agencies (is_beta, beta_ends_at)
    WHERE is_beta = true;

COMMENT ON COLUMN agencies.is_beta IS 'True if this agency signed up via a beta promo code';
COMMENT ON COLUMN agencies.beta_ends_at IS 'Fixed date when beta access expires (all beta users share the same end date)';
