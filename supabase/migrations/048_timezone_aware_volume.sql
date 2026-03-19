-- Add timezone parameter to get_call_volume_by_day so chart dates
-- match the user's local timezone instead of always using UTC.
-- A call at 10pm EST on March 18 was previously grouped as March 19 (UTC).

CREATE OR REPLACE FUNCTION get_call_volume_by_day(
    p_agent_ids uuid[],
    p_since timestamptz,
    p_until timestamptz DEFAULT now(),
    p_client_id uuid DEFAULT NULL,
    p_timezone text DEFAULT 'UTC'
)
RETURNS TABLE(
    call_date date,
    call_count bigint
) AS $$
    SELECT
        (started_at AT TIME ZONE p_timezone)::date AS call_date,
        count(*) AS call_count
    FROM calls
    WHERE agent_id = ANY(p_agent_ids)
      AND started_at >= p_since
      AND started_at <= p_until
      AND (p_client_id IS NULL OR client_id = p_client_id)
    GROUP BY 1
    ORDER BY 1;
$$ LANGUAGE sql STABLE;
