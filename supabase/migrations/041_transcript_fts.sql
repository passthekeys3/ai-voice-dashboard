-- Full-text search infrastructure for call transcripts
-- Replaces ilike pattern matching with PostgreSQL tsvector + GIN for performance.

-- Ensure search path includes public schema
SET search_path TO public;

-- 1. Add tsvector column for pre-computed full-text search vectors
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transcript_search tsvector;

-- 2. Backfill existing rows with tsvector data
UPDATE public.calls
SET transcript_search = to_tsvector('english', COALESCE(transcript, ''))
WHERE transcript IS NOT NULL AND transcript != '';

-- 3. GIN index for fast full-text search lookups
CREATE INDEX IF NOT EXISTS idx_calls_transcript_search
ON public.calls USING GIN (transcript_search);

-- 4. Trigger function to auto-update tsvector when transcript changes
CREATE OR REPLACE FUNCTION public.calls_transcript_search_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.transcript_search := to_tsvector('english', COALESCE(NEW.transcript, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calls_transcript_search ON public.calls;
CREATE TRIGGER trg_calls_transcript_search
    BEFORE INSERT OR UPDATE OF transcript ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.calls_transcript_search_update();

-- 5. The trigger above handles UPDATE OF transcript, so any change to the transcript
-- column (including via the append_transcript_line RPC) will automatically
-- recalculate transcript_search. No changes needed to the existing function.
