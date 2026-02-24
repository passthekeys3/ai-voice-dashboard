-- ============================================
-- Webhook event deduplication table
-- ============================================
-- Tracks processed Stripe webhook event IDs to prevent duplicate processing.
-- No RLS needed — only accessed via service client from webhook routes.

CREATE TABLE IF NOT EXISTS webhook_events (
    event_id   TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE webhook_events IS 'Stripe webhook event IDs for at-most-once delivery';
