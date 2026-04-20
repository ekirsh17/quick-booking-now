-- Enforce minimum one active staff per enforced location.
-- Existing zero-staff locations are grandfathered by leaving min_staff_enforced_at NULL.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS min_staff_enforced_at timestamptz;

-- Backfill enforcement only for locations that already have at least one active staff member.
WITH active_staff_locations AS (
  SELECT s.location_id
  FROM public.staff s
  WHERE s.location_id IS NOT NULL
    AND COALESCE(s.active, true) = true
  GROUP BY s.location_id
)
UPDATE public.locations l
SET min_staff_enforced_at = COALESCE(l.min_staff_enforced_at, now())
FROM active_staff_locations asl
WHERE l.id = asl.location_id
  AND l.min_staff_enforced_at IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_min_staff_per_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_ids uuid[] := ARRAY[]::uuid[];
  v_location_id uuid;
  v_active_staff_count integer;
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.location_id IS NOT NULL THEN
    v_location_ids := array_append(v_location_ids, OLD.location_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.location_id IS NOT NULL THEN
    v_location_ids := array_append(v_location_ids, NEW.location_id);
  END IF;

  FOR v_location_id IN
    SELECT DISTINCT unnest(v_location_ids)
  LOOP
    -- Only enforce for existing locations explicitly marked as enforced.
    IF EXISTS (
      SELECT 1
      FROM public.locations l
      WHERE l.id = v_location_id
        AND l.min_staff_enforced_at IS NOT NULL
    ) THEN
      SELECT COUNT(*)
      INTO v_active_staff_count
      FROM public.staff s
      WHERE s.location_id = v_location_id
        AND COALESCE(s.active, true) = true;

      IF v_active_staff_count = 0 THEN
        RAISE EXCEPTION 'MIN_STAFF_LOCATION_REQUIRED: location % must keep at least one active staff member', v_location_id
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_min_staff_per_location ON public.staff;
CREATE CONSTRAINT TRIGGER trg_enforce_min_staff_per_location
AFTER INSERT OR UPDATE OR DELETE ON public.staff
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_min_staff_per_location();

CREATE OR REPLACE FUNCTION public.enable_min_staff_enforcement_for_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.location_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.active, true) = false THEN
    RETURN NEW;
  END IF;

  UPDATE public.locations
  SET min_staff_enforced_at = COALESCE(min_staff_enforced_at, now())
  WHERE id = NEW.location_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enable_min_staff_enforcement_for_location ON public.staff;
CREATE TRIGGER trg_enable_min_staff_enforcement_for_location
AFTER INSERT OR UPDATE OF location_id, active ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.enable_min_staff_enforcement_for_location();

CREATE OR REPLACE FUNCTION public.create_location_with_initial_staff(
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_time_zone text DEFAULT NULL,
  p_staff_name text DEFAULT NULL
)
RETURNS TABLE(location_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid := auth.uid();
  v_location_id uuid;
  v_staff_name text;
  v_active_staff_count integer;
  v_seats_total integer := 1;
  v_unlimited_staff boolean := false;
BEGIN
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(trim(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'LOCATION_NAME_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  v_staff_name := NULLIF(trim(COALESCE(p_staff_name, '')), '');
  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'INITIAL_STAFF_NAME_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
  INTO v_active_staff_count
  FROM public.staff s
  WHERE s.merchant_id = v_merchant_id
    AND COALESCE(s.active, true) = true;

  SELECT COALESCE(s.seats_count, 1), COALESCE(p.is_unlimited_staff, false)
  INTO v_seats_total, v_unlimited_staff
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.merchant_id = v_merchant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT COALESCE(v_unlimited_staff, false)
     AND v_active_staff_count >= COALESCE(v_seats_total, 1) THEN
    RAISE EXCEPTION 'SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.locations (
    merchant_id,
    name,
    address,
    phone,
    time_zone,
    min_staff_enforced_at
  )
  VALUES (
    v_merchant_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_time_zone, '')), ''), 'America/New_York'),
    now()
  )
  RETURNING id INTO v_location_id;

  INSERT INTO public.staff (
    merchant_id,
    name,
    is_primary,
    active,
    location_id
  )
  VALUES (
    v_merchant_id,
    v_staff_name,
    false,
    true,
    v_location_id
  );

  RETURN QUERY SELECT v_location_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_location_with_staff_cleanup(
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid := auth.uid();
  v_default_location_id uuid;
  v_location_count integer;
  v_opening_count integer;
  v_exists boolean;
BEGIN
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.locations l
    WHERE l.id = p_location_id
      AND l.merchant_id = v_merchant_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'LOCATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.default_location_id
  INTO v_default_location_id
  FROM public.profiles p
  WHERE p.id = v_merchant_id;

  IF v_default_location_id = p_location_id THEN
    RAISE EXCEPTION 'DEFAULT_LOCATION_CANNOT_BE_DELETED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
  INTO v_location_count
  FROM public.locations l
  WHERE l.merchant_id = v_merchant_id;

  IF v_location_count <= 1 THEN
    RAISE EXCEPTION 'LAST_LOCATION_CANNOT_BE_DELETED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
  INTO v_opening_count
  FROM public.slots s
  WHERE s.merchant_id = v_merchant_id
    AND s.location_id = p_location_id
    AND s.deleted_at IS NULL;

  IF v_opening_count > 0 THEN
    RAISE EXCEPTION 'LOCATION_HAS_OPENINGS' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.staff s
  WHERE s.merchant_id = v_merchant_id
    AND s.location_id = p_location_id;

  DELETE FROM public.locations l
  WHERE l.merchant_id = v_merchant_id
    AND l.id = p_location_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_location_with_initial_staff(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_location_with_staff_cleanup(uuid) TO authenticated;

-- Ensure profile bootstrap creates both a default location and at least one staff member,
-- then marks that location as enforced.
CREATE OR REPLACE FUNCTION public.create_default_location_for_profile()
RETURNS TRIGGER AS $$
DECLARE
  loc_id uuid;
  existing_staff_id uuid;
BEGIN
  IF NEW.default_location_id IS NOT NULL THEN
    loc_id := NEW.default_location_id;
  ELSE
    SELECT id INTO loc_id
    FROM public.locations
    WHERE merchant_id = NEW.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF loc_id IS NULL THEN
      INSERT INTO public.locations (merchant_id, name, address, phone, time_zone, min_staff_enforced_at)
      VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.business_name, ''), 'Default Location'),
        NEW.address,
        NEW.phone,
        COALESCE(NEW.time_zone, 'America/New_York'),
        now()
      )
      RETURNING id INTO loc_id;
    ELSE
      UPDATE public.locations
      SET min_staff_enforced_at = COALESCE(min_staff_enforced_at, now())
      WHERE id = loc_id;
    END IF;

    UPDATE public.profiles
    SET default_location_id = loc_id
    WHERE id = NEW.id;
  END IF;

  SELECT s.id INTO existing_staff_id
  FROM public.staff s
  WHERE s.merchant_id = NEW.id
    AND s.location_id = loc_id
    AND COALESCE(s.active, true) = true
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF existing_staff_id IS NULL THEN
    INSERT INTO public.staff (merchant_id, name, is_primary, active, location_id)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.business_name, ''), 'Primary Staff'),
      true,
      true,
      loc_id
    );
  END IF;

  UPDATE public.locations
  SET min_staff_enforced_at = COALESCE(min_staff_enforced_at, now())
  WHERE id = loc_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
