-- White-Label Branding Schema Updates
-- Migration 005

-- Add branding column to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- branding structure:
-- {
--   "logo_url": "https://...",
--   "primary_color": "#3b82f6",
--   "accent_color": "#10b981",
--   "sidebar_color": "#0f172a",
--   "favicon_url": "https://..."
-- }

-- Create storage bucket for branding assets (logos, favicons)
-- Note: This needs to be done via Supabase dashboard or CLI:
-- 1. Create bucket named 'branding'
-- 2. Make it public or add appropriate policies

COMMENT ON COLUMN agencies.branding IS 'JSON object containing white-label branding settings (logo_url, colors, etc.)';
