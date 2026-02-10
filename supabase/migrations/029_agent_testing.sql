-- Agent Testing Schema
-- Migration 029: Pre-deployment AI voice agent testing

-- Test suites — a collection of test cases for a specific agent
CREATE TABLE IF NOT EXISTS test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    agent_prompt_snapshot TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Test personas — reusable caller personality profiles
CREATE TABLE IF NOT EXISTS test_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    traits JSONB NOT NULL DEFAULT '{}',
    is_preset BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Test cases — individual test scenarios within a suite
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE NOT NULL,
    persona_id UUID REFERENCES test_personas(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    scenario TEXT NOT NULL,
    success_criteria JSONB NOT NULL DEFAULT '[]',
    max_turns INT DEFAULT 20,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Test runs — a batch execution of an entire test suite
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    test_suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    prompt_tested TEXT NOT NULL,
    prompt_source TEXT DEFAULT 'current',
    experiment_variant_id UUID REFERENCES experiment_variants(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_cases INT DEFAULT 0,
    passed_cases INT DEFAULT 0,
    failed_cases INT DEFAULT 0,
    errored_cases INT DEFAULT 0,
    avg_score NUMERIC(5,2),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    total_input_tokens INT DEFAULT 0,
    total_output_tokens INT DEFAULT 0,
    estimated_cost_cents INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Test results — per-test-case results within a run
CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE NOT NULL,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE NOT NULL,
    persona_id UUID REFERENCES test_personas(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    transcript JSONB DEFAULT '[]',
    turn_count INT DEFAULT 0,
    criteria_results JSONB DEFAULT '[]',
    overall_score INT,
    evaluation_summary TEXT,
    sentiment TEXT,
    topics TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_suites_agency ON test_suites(agency_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_agent ON test_suites(agent_id);
CREATE INDEX IF NOT EXISTS idx_test_personas_agency ON test_personas(agency_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_agency ON test_runs(agency_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON test_runs(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_results_run ON test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_case ON test_results(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);

-- Enable RLS
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test_suites
CREATE POLICY "Agency members can view test suites"
    ON test_suites FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Agency admins can manage test suites"
    ON test_suites FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- RLS Policies for test_personas (includes preset access)
CREATE POLICY "Agency members can view personas"
    ON test_personas FOR SELECT
    USING (
        is_preset = true OR
        agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Agency admins can manage personas"
    ON test_personas FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- RLS Policies for test_cases (through suite)
CREATE POLICY "Agency members can view test cases"
    ON test_cases FOR SELECT
    USING (test_suite_id IN (
        SELECT id FROM test_suites WHERE agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Agency admins can manage test cases"
    ON test_cases FOR ALL
    USING (test_suite_id IN (
        SELECT id FROM test_suites WHERE agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
        )
    ));

-- RLS Policies for test_runs
CREATE POLICY "Agency members can view test runs"
    ON test_runs FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Agency admins can manage test runs"
    ON test_runs FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- RLS Policies for test_results (through run)
CREATE POLICY "Agency members can view test results"
    ON test_results FOR SELECT
    USING (test_run_id IN (
        SELECT id FROM test_runs WHERE agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Agency admins can manage test results"
    ON test_results FOR ALL
    USING (test_run_id IN (
        SELECT id FROM test_runs WHERE agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
        )
    ));

-- Comments
COMMENT ON TABLE test_suites IS 'Collections of test cases for validating agent behavior';
COMMENT ON TABLE test_personas IS 'Reusable caller personality profiles for test simulations';
COMMENT ON TABLE test_cases IS 'Individual test scenarios with success criteria';
COMMENT ON TABLE test_runs IS 'Batch execution records for test suites';
COMMENT ON TABLE test_results IS 'Per-test-case results including simulated transcripts';
COMMENT ON COLUMN test_runs.prompt_source IS 'Source of prompt tested: current, custom, or experiment_variant';
COMMENT ON COLUMN test_runs.status IS 'Run lifecycle: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN test_results.status IS 'Result status: pending, running, passed, failed, errored';
