-- A/B Testing Experiments Schema
-- Migration 008

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',  -- draft, running, paused, completed
    goal TEXT NOT NULL DEFAULT 'conversion',  -- conversion, duration, sentiment
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    winner_variant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Experiment variants table
CREATE TABLE IF NOT EXISTS experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,  -- "Control", "Variant A", etc.
    prompt TEXT NOT NULL,
    traffic_weight INT NOT NULL DEFAULT 50,  -- percentage 0-100
    is_control BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add experiment tracking to calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES experiments(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES experiment_variants(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_experiments_agency ON experiments(agency_id);
CREATE INDEX IF NOT EXISTS idx_experiments_agent ON experiments(agent_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_calls_experiment ON calls(experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_variant ON calls(variant_id) WHERE variant_id IS NOT NULL;

-- Enable RLS
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for experiments
CREATE POLICY "Agency members can view experiments"
    ON experiments FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Agency admins can manage experiments"
    ON experiments FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- RLS Policies for variants
CREATE POLICY "Agency members can view variants"
    ON experiment_variants FOR SELECT
    USING (experiment_id IN (
        SELECT id FROM experiments WHERE agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Agency admins can manage variants"
    ON experiment_variants FOR ALL
    USING (experiment_id IN (
        SELECT id FROM experiments WHERE agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
        )
    ));

-- Add foreign key for winner_variant_id after variants table exists
ALTER TABLE experiments 
    ADD CONSTRAINT fk_winner_variant 
    FOREIGN KEY (winner_variant_id) 
    REFERENCES experiment_variants(id) 
    ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE experiments IS 'A/B testing experiments for agent prompts';
COMMENT ON TABLE experiment_variants IS 'Prompt variants within an experiment';
COMMENT ON COLUMN experiments.status IS 'Experiment lifecycle: draft, running, paused, completed';
COMMENT ON COLUMN experiments.goal IS 'What to optimize for: conversion, duration, sentiment';
COMMENT ON COLUMN experiment_variants.traffic_weight IS 'Percentage of traffic to send to this variant (0-100)';
