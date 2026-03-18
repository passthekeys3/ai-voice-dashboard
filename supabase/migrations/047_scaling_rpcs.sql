-- Scaling RPCs: push aggregation into Postgres to avoid loading all rows into JS memory.
-- Replaces unbounded client-side aggregation in dashboard home + analytics pages.

-- Dashboard stats: total calls, minutes, cost, success rate for an agency
CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_agent_ids uuid[],
    p_since timestamptz,
    p_client_id uuid DEFAULT NULL
)
RETURNS TABLE(
    total_calls bigint,
    total_seconds bigint,
    total_cost_cents bigint,
    completed_calls bigint
) AS $$
    SELECT
        count(*),
        coalesce(sum(duration_seconds), 0),
        coalesce(sum(cost_cents), 0),
        count(*) FILTER (WHERE status = 'completed')
    FROM calls
    WHERE agent_id = ANY(p_agent_ids)
      AND started_at >= p_since
      AND (p_client_id IS NULL OR client_id = p_client_id);
$$ LANGUAGE sql STABLE;

-- Call volume by day: returns date + count for charting
CREATE OR REPLACE FUNCTION get_call_volume_by_day(
    p_agent_ids uuid[],
    p_since timestamptz,
    p_until timestamptz DEFAULT now(),
    p_client_id uuid DEFAULT NULL
)
RETURNS TABLE(
    call_date date,
    call_count bigint
) AS $$
    SELECT
        (started_at AT TIME ZONE 'UTC')::date AS call_date,
        count(*) AS call_count
    FROM calls
    WHERE agent_id = ANY(p_agent_ids)
      AND started_at >= p_since
      AND started_at <= p_until
      AND (p_client_id IS NULL OR client_id = p_client_id)
    GROUP BY 1
    ORDER BY 1;
$$ LANGUAGE sql STABLE;

-- Analytics aggregation: stats + calls by agent
CREATE OR REPLACE FUNCTION get_analytics_by_agent(
    p_agent_ids uuid[],
    p_since timestamptz,
    p_until timestamptz DEFAULT now(),
    p_client_id uuid DEFAULT NULL
)
RETURNS TABLE(
    agent_id uuid,
    call_count bigint,
    total_seconds bigint,
    total_cost_cents bigint,
    completed_count bigint
) AS $$
    SELECT
        c.agent_id,
        count(*),
        coalesce(sum(c.duration_seconds), 0),
        coalesce(sum(c.cost_cents), 0),
        count(*) FILTER (WHERE c.status = 'completed')
    FROM calls c
    WHERE c.agent_id = ANY(p_agent_ids)
      AND c.started_at >= p_since
      AND c.started_at <= p_until
      AND (p_client_id IS NULL OR c.client_id = p_client_id)
    GROUP BY c.agent_id;
$$ LANGUAGE sql STABLE;
