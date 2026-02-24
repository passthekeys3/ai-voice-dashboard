-- Atomic transcript append function to avoid race conditions
-- when Vapi sends rapid transcript webhook events concurrently.
CREATE OR REPLACE FUNCTION append_transcript_line(
    p_external_id TEXT,
    p_new_line TEXT,
    p_max_length INT DEFAULT 500000
)
RETURNS TABLE(transcript TEXT) AS $$
    UPDATE calls
    SET transcript = LEFT(
        CASE
            WHEN calls.transcript IS NULL OR calls.transcript = '' THEN p_new_line
            ELSE calls.transcript || E'\n' || p_new_line
        END,
        p_max_length
    )
    WHERE calls.external_id = p_external_id
    RETURNING calls.transcript;
$$ LANGUAGE sql;
