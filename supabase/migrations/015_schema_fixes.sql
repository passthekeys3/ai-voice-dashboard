-- Schema Fixes Migration
-- Migration 015
-- Adds missing indexes, constraints, and triggers for database integrity and performance

-- ============================================
-- 1. UNIQUE CONSTRAINT ON calls.external_id
-- CRITICAL: Required for webhook upserts with onConflict: 'external_id'
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_external_id ON calls(external_id);

-- ============================================
-- 2. PERFORMANCE INDEXES
-- ============================================

-- Index on calls.provider for filtering by provider
CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider);

-- Composite index for analytics queries (agent performance over time)
CREATE INDEX IF NOT EXISTS idx_calls_agent_started_at ON calls(agent_id, started_at);

-- Index on profiles.role for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================
-- 3. CHECK CONSTRAINT ON experiment_variants.traffic_weight
-- Ensures traffic weight is between 0-100
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'experiment_variants_traffic_weight_check'
    ) THEN
        ALTER TABLE experiment_variants
        ADD CONSTRAINT experiment_variants_traffic_weight_check
        CHECK (traffic_weight >= 0 AND traffic_weight <= 100);
    END IF;
END $$;

-- ============================================
-- 4. ADD updated_at COLUMN TO knowledge_base_sources
-- This table was missing the updated_at column entirely
-- ============================================
ALTER TABLE knowledge_base_sources
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 5. UPDATED_AT TRIGGERS FOR TABLES MISSING THEM
-- ============================================

-- knowledge_base_sources trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'knowledge_base_sources_updated_at'
    ) THEN
        CREATE TRIGGER knowledge_base_sources_updated_at
            BEFORE UPDATE ON knowledge_base_sources
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- experiment_variants trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'experiment_variants_updated_at'
    ) THEN
        CREATE TRIGGER experiment_variants_updated_at
            BEFORE UPDATE ON experiment_variants
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- scheduled_calls trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'scheduled_calls_updated_at'
    ) THEN
        CREATE TRIGGER scheduled_calls_updated_at
            BEFORE UPDATE ON scheduled_calls
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- phone_numbers trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'phone_numbers_updated_at'
    ) THEN
        CREATE TRIGGER phone_numbers_updated_at
            BEFORE UPDATE ON phone_numbers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON INDEX idx_calls_external_id IS 'Unique index for webhook upserts using onConflict';
COMMENT ON INDEX idx_calls_provider IS 'Performance index for filtering calls by provider';
COMMENT ON INDEX idx_calls_agent_started_at IS 'Composite index for agent analytics queries';
COMMENT ON INDEX idx_profiles_role IS 'Performance index for RLS policy role checks';
