-- Add unique constraint on agencies.slug to prevent collisions
ALTER TABLE agencies ADD CONSTRAINT agencies_slug_unique UNIQUE (slug);
