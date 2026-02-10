-- Migration: White-Label Support
-- Description: Add custom domain support and enhance branding capabilities

-- =====================================================
-- CUSTOM DOMAIN SUPPORT
-- =====================================================

-- Add custom domain columns to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS domain_verification_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMPTZ;

-- Index for fast domain lookups (critical for middleware performance)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_custom_domain
ON agencies(custom_domain) WHERE custom_domain IS NOT NULL;

-- =====================================================
-- BRANDING JSONB DOCUMENTATION
-- =====================================================

-- The branding JSONB column already exists and supports:
-- {
--   "logo_url": "https://...",           -- Main logo (200x50px recommended)
--   "favicon_url": "https://...",        -- Favicon (32x32px)
--   "primary_color": "#0f172a",          -- Sidebar/main brand color
--   "secondary_color": "#1e293b",        -- Secondary UI color
--   "accent_color": "#3b82f6",           -- Accent/highlight color
--   "company_name": "Agency Name",       -- Display name
--   "tagline": "Your tagline",           -- Optional tagline
--   "website_url": "https://...",        -- Company website
--   "support_email": "support@...",      -- Support contact email
--   "support_phone": "+1...",            -- Support phone (optional)
--   "footer_text": "© 2024 ...",         -- Custom footer text
--   "login_message": "Welcome to ...",   -- Custom login page message
--   "custom_css": "..."                  -- Advanced: custom CSS overrides
-- }

-- Add default branding if agencies don't have it set
UPDATE agencies
SET branding = COALESCE(branding, '{}'::jsonb)
WHERE branding IS NULL;

-- =====================================================
-- SUBDOMAIN SUPPORT
-- =====================================================

-- Add slug column for subdomain routing (agency-slug.platform.com)
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS slug VARCHAR(63) UNIQUE;

-- Index for slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_slug
ON agencies(slug) WHERE slug IS NOT NULL;

-- Generate slugs for existing agencies based on name
UPDATE agencies
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL AND name IS NOT NULL;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate a secure domain verification token
CREATE OR REPLACE FUNCTION generate_domain_verification_token()
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to get agency by domain (for middleware)
CREATE OR REPLACE FUNCTION get_agency_by_domain(domain_name VARCHAR)
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    slug VARCHAR,
    branding JSONB,
    domain_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.slug,
        a.branding,
        a.domain_verified
    FROM agencies a
    WHERE a.custom_domain = domain_name
       OR a.slug = SPLIT_PART(domain_name, '.', 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN agencies.custom_domain IS 'Custom domain for white-label (e.g., dashboard.client-agency.com)';
COMMENT ON COLUMN agencies.domain_verified IS 'Whether the custom domain DNS has been verified';
COMMENT ON COLUMN agencies.domain_verification_token IS 'Token for DNS TXT record verification';
COMMENT ON COLUMN agencies.slug IS 'URL-safe slug for subdomain routing (e.g., agency-name.platform.com)';
COMMENT ON FUNCTION get_agency_by_domain IS 'Lookup agency by custom domain or subdomain slug';
