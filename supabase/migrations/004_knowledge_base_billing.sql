-- Knowledge Base & Billing Schema Updates
-- Migration 004

-- ============================================
-- KNOWLEDGE BASES TABLE
-- Stores knowledge bases linked to agents
-- ============================================
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    external_id TEXT, -- Retell KB ID
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id) -- One KB per agent
);

-- ============================================
-- KNOWLEDGE BASE SOURCES TABLE
-- Individual sources (files, URLs, text) in a KB
-- ============================================
CREATE TABLE knowledge_base_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    external_id TEXT, -- Retell source ID
    source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'text')),
    name TEXT NOT NULL,
    url TEXT, -- For URL sources or file download URL
    content TEXT, -- For text sources
    file_size_bytes INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BILLING UPDATES
-- Add Stripe customer portal support
-- ============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_fee_cents INTEGER DEFAULT 0;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_knowledge_bases_agent_id ON knowledge_bases(agent_id);
CREATE INDEX idx_knowledge_base_sources_kb_id ON knowledge_base_sources(knowledge_base_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER knowledge_bases_updated_at
    BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_sources ENABLE ROW LEVEL SECURITY;

-- Agency users can view/manage knowledge bases for their agents
CREATE POLICY "Agency users can view knowledge bases"
    ON knowledge_bases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = knowledge_bases.agent_id 
            AND agents.agency_id = get_user_agency_id()
        )
    );

CREATE POLICY "Agency admins can manage knowledge bases"
    ON knowledge_bases FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = knowledge_bases.agent_id 
            AND agents.agency_id = get_user_agency_id()
        ) AND is_agency_admin()
    );

CREATE POLICY "Agency users can view knowledge base sources"
    ON knowledge_base_sources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases kb
            JOIN agents ON agents.id = kb.agent_id
            WHERE kb.id = knowledge_base_sources.knowledge_base_id
            AND agents.agency_id = get_user_agency_id()
        )
    );

CREATE POLICY "Agency admins can manage knowledge base sources"
    ON knowledge_base_sources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases kb
            JOIN agents ON agents.id = kb.agent_id
            WHERE kb.id = knowledge_base_sources.knowledge_base_id
            AND agents.agency_id = get_user_agency_id()
        ) AND is_agency_admin()
    );
