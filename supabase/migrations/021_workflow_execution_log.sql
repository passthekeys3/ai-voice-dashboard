-- Workflow Execution Log
-- Persists results of every workflow execution for observability and debugging

CREATE TABLE IF NOT EXISTS workflow_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE NOT NULL,
    call_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',  -- running | completed | partial_failure | failed | skipped
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    actions_total INTEGER NOT NULL DEFAULT 0,
    actions_succeeded INTEGER NOT NULL DEFAULT 0,
    actions_failed INTEGER NOT NULL DEFAULT 0,
    action_results JSONB DEFAULT '[]',       -- [{action_index, action_type, status, duration_ms, error, attempts}]
    error_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_wf_exec_log_agency ON workflow_execution_log(agency_id);
CREATE INDEX idx_wf_exec_log_workflow ON workflow_execution_log(workflow_id);
CREATE INDEX idx_wf_exec_log_created ON workflow_execution_log(created_at DESC);
CREATE INDEX idx_wf_exec_log_agency_status ON workflow_execution_log(agency_id, status);
CREATE INDEX idx_wf_exec_log_call ON workflow_execution_log(call_id);

-- RLS
ALTER TABLE workflow_execution_log ENABLE ROW LEVEL SECURITY;

-- Agency members can view their execution logs
CREATE POLICY "Agency members can view workflow execution logs"
    ON workflow_execution_log
    FOR SELECT
    USING (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Service role can insert/update (webhook handlers bypass RLS)
CREATE POLICY "Service role can manage workflow execution logs"
    ON workflow_execution_log
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Auto-cleanup: delete logs older than 90 days (optional cron)
-- Can be run via: DELETE FROM workflow_execution_log WHERE created_at < now() - interval '90 days';
