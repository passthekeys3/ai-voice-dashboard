-- Webhook delivery log for tracking outbound webhook attempts
-- Enables users to see delivery history and debug integration issues
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    call_id TEXT,
    event TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    status_code INT,
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    attempt INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for agency-scoped queries ordered by recency
CREATE INDEX IF NOT EXISTS idx_wdl_agency_created
    ON webhook_delivery_log(agency_id, created_at DESC);

-- Auto-clean old entries (keep 30 days)
CREATE INDEX IF NOT EXISTS idx_wdl_created_at
    ON webhook_delivery_log(created_at);

-- RLS
ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by webhook handlers)
-- No user-facing RLS policy needed — API route uses service client
