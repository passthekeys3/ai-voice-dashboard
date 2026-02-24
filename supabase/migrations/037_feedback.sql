-- Migration: In-app feedback widget
-- Stores bug reports, feature requests, and general feedback from users

CREATE TABLE IF NOT EXISTS feedback (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email     TEXT NOT NULL,
    type           TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'general')),
    title          TEXT NOT NULL,
    description    TEXT NOT NULL,
    page_url       TEXT,
    browser_info   TEXT,
    status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'dismissed')),
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_feedback_agency ON feedback(agency_id);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert feedback for their own agency
CREATE POLICY "Users can submit feedback"
    ON feedback FOR INSERT
    WITH CHECK (
        agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Users can view their own feedback submissions
CREATE POLICY "Users can view own feedback"
    ON feedback FOR SELECT
    USING (user_id = auth.uid());

-- Agency admins can view all feedback for their agency
CREATE POLICY "Agency admins can view agency feedback"
    ON feedback FOR SELECT
    USING (
        agency_id IN (
            SELECT agency_id FROM profiles
            WHERE id = auth.uid()
            AND role IN ('agency_admin', 'agency_member')
        )
    );

-- Service role bypass for API routes using createServiceClient
CREATE POLICY "Service role full access"
    ON feedback FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
