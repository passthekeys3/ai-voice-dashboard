-- Insights aggregation RPC function
-- Replaces in-memory Node.js aggregation with database-level SQL for performance.
-- Returns the full InsightsData shape as JSONB in a single query.

-- Ensure search path includes public schema
SET search_path TO public;

CREATE OR REPLACE FUNCTION public.get_insights(
    p_agency_id UUID,
    p_days INT,
    p_agent_id UUID DEFAULT NULL,
    p_client_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Defense-in-depth: validate p_days even though the API layer checks 1-365
    IF p_days < 1 OR p_days > 365 THEN
        RAISE EXCEPTION 'p_days must be between 1 and 365, got %', p_days;
    END IF;

    WITH filtered_calls AS (
        SELECT
            c.id,
            c.agent_id,
            c.duration_seconds,
            c.sentiment,
            c.conversion_score,
            c.call_score,
            c.topics,
            c.objections,
            c.started_at,
            a.name AS agent_name
        FROM public.calls c
        INNER JOIN public.agents a ON a.id = c.agent_id
        WHERE a.agency_id = p_agency_id
          AND c.started_at >= (NOW() - (p_days || ' days')::INTERVAL)
          AND (p_agent_id IS NULL OR c.agent_id = p_agent_id)
          AND (p_client_id IS NULL OR c.client_id = p_client_id)
    ),

    -- Basic aggregate stats
    basic_stats AS (
        SELECT
            COUNT(*)::INT AS total_calls,
            COALESCE(ROUND(AVG(duration_seconds))::INT, 0) AS avg_duration,
            COALESCE(
                ROUND(AVG(conversion_score) FILTER (WHERE conversion_score IS NOT NULL))::INT,
                0
            ) AS avg_conversion_score,
            COALESCE(
                ROUND(AVG(call_score) FILTER (WHERE call_score IS NOT NULL))::INT,
                0
            ) AS avg_call_score
        FROM filtered_calls
    ),

    -- Sentiment breakdown (matches JS: includes('positive') → positive, includes('negative') → negative, else → neutral)
    sentiment_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE LOWER(sentiment) LIKE '%positive%') AS positive_count,
            COUNT(*) FILTER (WHERE LOWER(sentiment) LIKE '%negative%') AS negative_count,
            COUNT(*) FILTER (
                WHERE sentiment IS NOT NULL
                  AND sentiment != ''
                  AND LOWER(sentiment) NOT LIKE '%positive%'
                  AND LOWER(sentiment) NOT LIKE '%negative%'
            ) AS neutral_count,
            COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment != '') AS total_with_sentiment
        FROM filtered_calls
    ),

    -- Daily sentiment trend
    sentiment_trend AS (
        SELECT
            DATE(started_at) AS dt,
            COUNT(*) FILTER (WHERE LOWER(sentiment) LIKE '%positive%') AS pos,
            COUNT(*) FILTER (WHERE LOWER(sentiment) LIKE '%negative%') AS neg,
            COUNT(*) FILTER (
                WHERE LOWER(sentiment) NOT LIKE '%positive%'
                  AND LOWER(sentiment) NOT LIKE '%negative%'
            ) AS neu,
            COUNT(*) AS day_total
        FROM filtered_calls
        WHERE sentiment IS NOT NULL AND sentiment != ''
        GROUP BY DATE(started_at)
        ORDER BY dt
    ),

    -- Top 10 topics (unnest TEXT[] array)
    top_topics AS (
        SELECT topic, COUNT(*)::INT AS cnt
        FROM filtered_calls, UNNEST(topics) AS topic
        GROUP BY topic
        ORDER BY cnt DESC
        LIMIT 10
    ),

    -- Top 10 objections (unnest TEXT[] array)
    top_objections AS (
        SELECT objection, COUNT(*)::INT AS cnt
        FROM filtered_calls, UNNEST(objections) AS objection
        GROUP BY objection
        ORDER BY cnt DESC
        LIMIT 10
    ),

    -- Agent performance
    -- Sentiment scoring matches JS: positive=1.0, negative=0.0, else=0.5
    -- Only include calls with actual sentiment data in the average to avoid skew
    agent_perf AS (
        SELECT
            agent_id,
            agent_name,
            COUNT(*)::INT AS call_count,
            ROUND(AVG(duration_seconds))::INT AS avg_duration,
            COALESCE(
                ROUND(
                    AVG(
                        CASE
                            WHEN LOWER(sentiment) LIKE '%positive%' THEN 1.0
                            WHEN LOWER(sentiment) LIKE '%negative%' THEN 0.0
                            ELSE 0.5
                        END
                    ) FILTER (WHERE sentiment IS NOT NULL AND sentiment != '') * 100
                )::INT,
                50
            ) AS avg_sentiment,
            COALESCE(
                ROUND(AVG(conversion_score) FILTER (WHERE conversion_score IS NOT NULL))::INT,
                0
            ) AS avg_conversion
        FROM filtered_calls
        GROUP BY agent_id, agent_name
        ORDER BY avg_sentiment DESC
    )

    -- Assemble the full InsightsData JSONB object
    SELECT jsonb_build_object(
        'totalCalls', (SELECT total_calls FROM basic_stats),
        'avgDuration', (SELECT avg_duration FROM basic_stats),
        'avgConversionScore', (SELECT avg_conversion_score FROM basic_stats),
        'avgCallScore', (SELECT avg_call_score FROM basic_stats),
        'sentimentBreakdown', (
            SELECT jsonb_build_object(
                'positive', CASE WHEN total_with_sentiment > 0
                    THEN ROUND(positive_count::NUMERIC / total_with_sentiment * 100)::INT
                    ELSE 0 END,
                'neutral', CASE WHEN total_with_sentiment > 0
                    THEN ROUND(neutral_count::NUMERIC / total_with_sentiment * 100)::INT
                    ELSE 0 END,
                'negative', CASE WHEN total_with_sentiment > 0
                    THEN ROUND(negative_count::NUMERIC / total_with_sentiment * 100)::INT
                    ELSE 0 END
            )
            FROM sentiment_stats
        ),
        'sentimentTrend', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', dt::TEXT,
                    'positive', CASE WHEN day_total > 0
                        THEN ROUND(pos::NUMERIC / day_total * 100)::INT ELSE 0 END,
                    'neutral', CASE WHEN day_total > 0
                        THEN ROUND(neu::NUMERIC / day_total * 100)::INT ELSE 0 END,
                    'negative', CASE WHEN day_total > 0
                        THEN ROUND(neg::NUMERIC / day_total * 100)::INT ELSE 0 END
                ) ORDER BY dt
            )
            FROM sentiment_trend
        ), '[]'::JSONB),
        'topTopics', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('topic', topic, 'count', cnt)
                ORDER BY cnt DESC
            )
            FROM top_topics
        ), '[]'::JSONB),
        'topObjections', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('objection', objection, 'count', cnt)
                ORDER BY cnt DESC
            )
            FROM top_objections
        ), '[]'::JSONB),
        'agentPerformance', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'agent_id', agent_id,
                    'agent_name', agent_name,
                    'call_count', call_count,
                    'avg_duration', avg_duration,
                    'avg_sentiment', avg_sentiment,
                    'avg_conversion', avg_conversion
                ) ORDER BY avg_sentiment DESC
            )
            FROM agent_perf
        ), '[]'::JSONB)
    ) INTO result;

    RETURN result;
END;
$$;
