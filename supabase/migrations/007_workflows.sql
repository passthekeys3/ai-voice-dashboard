-- Workflows Schema
-- Migration 007

-- Workflows table for post-call automation
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,  -- null = applies to all agents
    name TEXT NOT NULL,
    description TEXT,
    trigger TEXT NOT NULL DEFAULT 'call_ended',  -- 'call_ended', 'call_started'
    conditions JSONB DEFAULT '[]',  -- [{field: 'duration_seconds', operator: '>', value: 60}]
    actions JSONB NOT NULL DEFAULT '[]',  -- [{type: 'webhook', config: {...}}]
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflows_agency ON workflows(agency_id);
CREATE INDEX IF NOT EXISTS idx_workflows_agent ON workflows(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agency admins can manage workflows"
    ON workflows FOR ALL
    USING (agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('agency_admin', 'agency_member')
    ));

-- Comments
COMMENT ON TABLE workflows IS 'Automated workflows triggered by call events';
COMMENT ON COLUMN workflows.trigger IS 'Event that triggers the workflow: call_ended, call_started';
COMMENT ON COLUMN workflows.conditions IS 'JSON array of conditions that must be met to run the workflow';
COMMENT ON COLUMN workflows.actions IS 'JSON array of actions to execute when workflow runs';

/*
Example actions structure:
[
    {
        "type": "webhook",
        "config": {
            "url": "https://hooks.zapier.com/...",
            "method": "POST",
            "headers": {}
        }
    },
    {
        "type": "ghl_log_call",
        "config": {}
    },
    {
        "type": "ghl_create_contact",
        "config": {
            "tags": ["new-lead"]
        }
    },
    {
        "type": "email",
        "config": {
            "to": "{{caller_email}}",
            "subject": "Call Summary",
            "template": "call_summary"
        }
    }
]

Example conditions structure:
[
    {
        "field": "duration_seconds",
        "operator": ">",
        "value": 60
    },
    {
        "field": "sentiment",
        "operator": "==",
        "value": "positive"
    }
]
*/
