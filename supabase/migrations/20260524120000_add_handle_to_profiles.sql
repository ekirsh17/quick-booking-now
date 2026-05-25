-- Migration: add handle column to profiles for vanity share links (e.g. openalert.org/davids-cuts)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;

-- Format constraint: 3-30 chars, a-z/0-9/hyphen, no leading/trailing/consecutive hyphens
ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_format
  CHECK (
    handle IS NULL OR (
      char_length(handle) BETWEEN 3 AND 30
      AND handle ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
      AND handle NOT LIKE '%--%'
    )
  );

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles (handle) WHERE handle IS NOT NULL;

-- RLS: allow anon to read profiles rows by handle (required for HandleRedirect).
-- Note: row-level policies cannot restrict which columns are visible;
-- the application layer SELECTs only 'id' to minimize exposure.
-- Existing policy "Anyone can view profiles" (USING true) also allows anon SELECT.
CREATE POLICY "anon_read_profile_by_handle"
  ON public.profiles FOR SELECT
  TO anon
  USING (handle IS NOT NULL);
