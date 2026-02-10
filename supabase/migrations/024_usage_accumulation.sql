-- Atomic usage increment function for per-minute billing
-- Safely handles concurrent calls by using ON CONFLICT + increments
CREATE OR REPLACE FUNCTION increment_usage(
    p_client_id UUID,
    p_period_start DATE,
    p_period_end DATE,
    p_calls INTEGER,
    p_minutes NUMERIC(10,2),
    p_cost_cents INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO usage (client_id, period_start, period_end, total_calls, total_minutes, total_cost_cents)
    VALUES (p_client_id, p_period_start, p_period_end, p_calls, p_minutes, p_cost_cents)
    ON CONFLICT (client_id, period_start, period_end)
    DO UPDATE SET
        total_calls = usage.total_calls + EXCLUDED.total_calls,
        total_minutes = usage.total_minutes + EXCLUDED.total_minutes,
        total_cost_cents = usage.total_cost_cents + EXCLUDED.total_cost_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
