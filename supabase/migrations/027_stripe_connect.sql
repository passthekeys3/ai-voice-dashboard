-- Stripe Connect: Allow agencies to connect their own Stripe account
-- and bill their business clients directly.

-- Add Stripe Connect columns to agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) DEFAULT 0;

-- Index for cron join (invoice generation looks up agencies by connect account)
CREATE INDEX IF NOT EXISTS idx_agencies_stripe_connect
  ON agencies (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
