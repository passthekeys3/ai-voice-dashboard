-- ============================================
-- PROSODY DASHBOARD - LAUNCH READY MIGRATION
-- Migration 014
-- ============================================
--
-- This consolidated migration includes all schema changes needed for launch:
--   1. Client Permissions System (from 012)
--   2. Phone Numbers Inbound/Outbound Agents (from 013)
--   3. Agency Subscription Billing
--   4. Client Billing Configuration
--
-- Safe to run multiple times - uses IF NOT EXISTS and DO blocks.
--
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: CLIENT PERMISSIONS SYSTEM
-- ============================================
-- Allows agencies to set default permissions for all clients,
-- and individual clients can override these defaults.
-- ============================================

-- Add default_client_permissions to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS default_client_permissions JSONB DEFAULT '{
  "show_costs": false,
  "show_transcripts": true,
  "show_analytics": true,
  "allow_playback": true
}'::jsonb;

-- Add permissions override to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

COMMENT ON COLUMN agencies.default_client_permissions IS 'Default permissions for all clients. Individual clients can override these via their permissions column.';
COMMENT ON COLUMN clients.permissions IS 'Per-client permission overrides. NULL means use agency defaults.';


-- ============================================
-- SECTION 2: PHONE NUMBERS - INBOUND/OUTBOUND AGENTS
-- ============================================
-- Separate inbound and outbound agent assignments for phone numbers.
-- ============================================

-- Add inbound_agent_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'phone_numbers'
        AND column_name = 'inbound_agent_id'
    ) THEN
        ALTER TABLE phone_numbers
        ADD COLUMN inbound_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add outbound_agent_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'phone_numbers'
        AND column_name = 'outbound_agent_id'
    ) THEN
        ALTER TABLE phone_numbers
        ADD COLUMN outbound_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Migrate existing agent_id data to inbound_agent_id
UPDATE phone_numbers
SET inbound_agent_id = agent_id
WHERE agent_id IS NOT NULL
  AND inbound_agent_id IS NULL;

-- Create indexes for efficient querying by agent
CREATE INDEX IF NOT EXISTS idx_phone_numbers_inbound_agent
    ON phone_numbers(inbound_agent_id);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_outbound_agent
    ON phone_numbers(outbound_agent_id);

-- Update unique constraint on external_id to be agency-scoped
DROP INDEX IF EXISTS idx_phone_numbers_external;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_external_agency
    ON phone_numbers(external_id, agency_id)
    WHERE external_id IS NOT NULL;

COMMENT ON COLUMN phone_numbers.inbound_agent_id IS 'Agent that handles inbound calls to this number.';
COMMENT ON COLUMN phone_numbers.outbound_agent_id IS 'Agent that uses this number for outbound calls.';


-- ============================================
-- SECTION 3: AGENCY SUBSCRIPTION BILLING
-- ============================================
-- Adds subscription-related fields to agencies table for Stripe billing.
-- ============================================

-- Subscription status enum type
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add subscription fields to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_price_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Index for quick lookup by subscription_id
CREATE INDEX IF NOT EXISTS idx_agencies_subscription_id ON agencies(subscription_id) WHERE subscription_id IS NOT NULL;

-- Index for quick lookup by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_agencies_stripe_customer_id ON agencies(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN agencies.subscription_status IS 'Current Stripe subscription status';
COMMENT ON COLUMN agencies.subscription_id IS 'Stripe subscription ID (sub_xxx)';
COMMENT ON COLUMN agencies.subscription_price_id IS 'Stripe price ID for the subscription';
COMMENT ON COLUMN agencies.subscription_current_period_start IS 'Start of current billing period';
COMMENT ON COLUMN agencies.subscription_current_period_end IS 'End of current billing period';
COMMENT ON COLUMN agencies.subscription_cancel_at_period_end IS 'Whether subscription will cancel at period end';


-- ============================================
-- SECTION 4: CLIENT BILLING CONFIGURATION
-- ============================================
-- Allows agencies to bill clients in 3 ways:
--   - subscription: Monthly subscription fee
--   - per_minute: Usage-based per-minute billing
--   - one_time: Single payment
-- ============================================

-- Create billing type enum
DO $$ BEGIN
    CREATE TYPE billing_type AS ENUM ('subscription', 'per_minute', 'one_time');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add billing fields to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_type billing_type DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_amount_cents INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ DEFAULT NULL;

-- Add constraints (safe - won't fail if already exists)
DO $$
BEGIN
    ALTER TABLE clients
    ADD CONSTRAINT billing_amount_positive CHECK (billing_amount_cents IS NULL OR billing_amount_cents >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add indexes for subscription and billing queries
CREATE INDEX IF NOT EXISTS idx_clients_stripe_subscription_id ON clients(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_next_billing_date ON clients(next_billing_date) WHERE next_billing_date IS NOT NULL;

COMMENT ON COLUMN clients.billing_type IS 'Client billing model: subscription, per_minute, or one_time';
COMMENT ON COLUMN clients.billing_amount_cents IS 'Amount in cents: monthly fee, per-minute rate, or one-time total';
COMMENT ON COLUMN clients.stripe_subscription_id IS 'Stripe subscription ID for subscription billing type';
COMMENT ON COLUMN clients.next_billing_date IS 'Next billing date for subscription clients';


-- ============================================
-- SECTION 5: VERIFICATION
-- ============================================

DO $$
DECLARE
    col_count INTEGER;
BEGIN
    -- Verify key columns exist
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'agencies'
    AND column_name IN ('default_client_permissions', 'subscription_status', 'subscription_id');

    IF col_count >= 3 THEN
        RAISE NOTICE 'SUCCESS: All agency columns exist';
    ELSE
        RAISE WARNING 'FAILED: Some agency columns missing (found %)', col_count;
    END IF;

    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'clients'
    AND column_name IN ('permissions', 'billing_type', 'billing_amount_cents');

    IF col_count >= 3 THEN
        RAISE NOTICE 'SUCCESS: All client columns exist';
    ELSE
        RAISE WARNING 'FAILED: Some client columns missing (found %)', col_count;
    END IF;

    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'phone_numbers'
    AND column_name IN ('inbound_agent_id', 'outbound_agent_id');

    IF col_count >= 2 THEN
        RAISE NOTICE 'SUCCESS: Phone number agent columns exist';
    ELSE
        RAISE WARNING 'FAILED: Phone number agent columns missing (found %)', col_count;
    END IF;

    RAISE NOTICE '--- Migration 014 verification complete ---';
END $$;

COMMIT;

-- ============================================
-- ENVIRONMENT VARIABLES REQUIRED
-- ============================================
-- STRIPE_SECRET_KEY - Stripe API secret key
-- STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
-- STRIPE_PRICE_ID - Stripe Price ID for agency subscriptions
-- NEXT_PUBLIC_APP_URL - Application URL for redirects
-- ============================================
