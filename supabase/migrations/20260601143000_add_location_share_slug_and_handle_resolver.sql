-- Add location-specific share slugs and public handle resolution helpers.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS share_slug text;

CREATE OR REPLACE FUNCTION public.normalize_location_share_slug(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9\s-]', '', 'g'),
      '[[:space:]]+',
      '-',
      'g'
    ),
    '-+',
    '-',
    'g'
  ));
$$;

-- Backfill existing locations with deterministic per-merchant slug dedupe.
WITH normalized AS (
  SELECT
    l.id,
    l.merchant_id,
    l.created_at,
    CASE
      WHEN char_length(raw_slug) >= 2 THEN raw_slug
      ELSE raw_slug || '-1'
    END AS base_slug
  FROM public.locations l
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(public.normalize_location_share_slug(COALESCE(NULLIF(l.share_slug, ''), l.name)), ''),
      'location'
    ) AS raw_slug
  ) normalized_input
),
ranked AS (
  SELECT
    n.id,
    n.base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY n.merchant_id, n.base_slug
      ORDER BY n.created_at ASC, n.id ASC
    ) AS slug_rank
  FROM normalized n
),
finalized AS (
  SELECT
    r.id,
    CASE
      WHEN r.slug_rank = 1 THEN r.base_slug
      ELSE
        left(r.base_slug, 40 - length(r.slug_rank::text) - 1)
        || '-'
        || r.slug_rank::text
    END AS final_slug
  FROM ranked r
)
UPDATE public.locations l
SET share_slug = f.final_slug
FROM finalized f
WHERE l.id = f.id
  AND (l.share_slug IS NULL OR l.share_slug <> f.final_slug);

ALTER TABLE public.locations
  DROP CONSTRAINT IF EXISTS locations_share_slug_format;

ALTER TABLE public.locations
  ADD CONSTRAINT locations_share_slug_format
  CHECK (
    share_slug IS NOT NULL
    AND char_length(share_slug) BETWEEN 2 AND 40
    AND share_slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    AND share_slug NOT LIKE '%--%'
  );

ALTER TABLE public.locations
  ALTER COLUMN share_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_merchant_share_slug_unique
  ON public.locations(merchant_id, share_slug);

CREATE INDEX IF NOT EXISTS idx_locations_share_slug
  ON public.locations(share_slug);

CREATE OR REPLACE FUNCTION public.assign_location_share_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  candidate text;
  suffix integer := 2;
BEGIN
  normalized := public.normalize_location_share_slug(
    CASE
      WHEN NEW.share_slug IS NULL OR btrim(NEW.share_slug) = '' THEN COALESCE(NEW.name, 'location')
      ELSE NEW.share_slug
    END
  );

  IF normalized = '' THEN
    normalized := 'location';
  END IF;

  IF char_length(normalized) < 2 THEN
    normalized := normalized || '-1';
  END IF;

  IF char_length(normalized) > 40 THEN
    normalized := left(normalized, 40);
    normalized := regexp_replace(normalized, '-+$', '');
  END IF;

  IF normalized = '' THEN
    normalized := 'location';
  END IF;

  candidate := normalized;

  WHILE EXISTS (
    SELECT 1
    FROM public.locations l
    WHERE l.merchant_id = NEW.merchant_id
      AND l.share_slug = candidate
      AND l.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    candidate := left(normalized, 40 - length(suffix::text) - 1) || '-' || suffix::text;
    suffix := suffix + 1;
  END LOOP;

  NEW.share_slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_location_share_slug ON public.locations;
CREATE TRIGGER trg_assign_location_share_slug
  BEFORE INSERT OR UPDATE OF name, share_slug, merchant_id ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_location_share_slug();

CREATE OR REPLACE FUNCTION public.resolve_public_handle_location(
  p_handle text,
  p_location_slug text
)
RETURNS TABLE (
  merchant_id uuid,
  location_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS merchant_id, l.id AS location_id
  FROM public.profiles p
  JOIN public.locations l
    ON l.merchant_id = p.id
  WHERE p.handle = lower(trim(coalesce(p_handle, '')))
    AND l.share_slug = public.normalize_location_share_slug(p_location_slug)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_public_locations_for_handle(
  p_handle text
)
RETURNS TABLE (
  merchant_id uuid,
  business_name text,
  location_id uuid,
  location_name text,
  location_address text,
  location_slug text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS merchant_id,
    p.business_name,
    l.id AS location_id,
    l.name AS location_name,
    l.address AS location_address,
    l.share_slug AS location_slug,
    l.created_at
  FROM public.profiles p
  JOIN public.locations l
    ON l.merchant_id = p.id
  WHERE p.handle = lower(trim(coalesce(p_handle, '')))
  ORDER BY l.created_at ASC, l.id ASC;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_handle_location(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_public_handle_location(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_public_locations_for_handle(text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_locations_for_handle(text) TO anon, authenticated;
