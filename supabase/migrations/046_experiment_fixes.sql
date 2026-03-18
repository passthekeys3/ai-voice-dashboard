-- Migration 046: Experiment fixes
--
-- 1. Unique partial index: prevent multiple running experiments per agent
-- 2. Remove redundant SELECT-only RLS policy on experiments (ALL policy already covers SELECT)
-- 3. Remove redundant SELECT-only RLS policy on experiment_variants

-- Prevent multiple running experiments for the same agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_experiments_one_running_per_agent
    ON experiments(agent_id)
    WHERE status = 'running';

-- Drop redundant SELECT policies (the ALL policies already cover SELECT)
DROP POLICY IF EXISTS "Agency members can view experiments" ON experiments;
DROP POLICY IF EXISTS "Agency members can view variants" ON experiment_variants;
