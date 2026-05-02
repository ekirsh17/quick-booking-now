-- Only treat openings/bookings as blocking location deletion when they start
-- on or after the current calendar date in the location's time zone.
-- Adds preview + bulk soft-delete of upcoming slots at a location.

CREATE OR REPLACE FUNCTION public.preview_location_deletion_slots(p_location_id uuid)
RETURNS TABLE(upcoming_count bigint, past_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid := auth.uid();
  v_tz text;
BEGIN
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(l.time_zone, 'America/New_York')
  INTO v_tz
  FROM public.locations l
  WHERE l.id = p_location_id
    AND l.merchant_id = v_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      COUNT(*) FILTER (
        WHERE (timezone(v_tz, s.start_time))::date >= (timezone(v_tz, now()))::date
      ),
      0
    )::bigint AS upcoming_count,
    COALESCE(
      COUNT(*) FILTER (
        WHERE (timezone(v_tz, s.start_time))::date < (timezone(v_tz, now()))::date
      ),
      0
    )::bigint AS past_count
  FROM public.slots s
  WHERE s.merchant_id = v_merchant_id
    AND s.location_id = p_location_id
    AND s.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_upcoming_slots_at_location(p_location_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid := auth.uid();
  v_tz text;
  v_count integer;
BEGIN
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(l.time_zone, 'America/New_York')
  INTO v_tz
  FROM public.locations l
  WHERE l.id = p_location_id
    AND l.merchant_id = v_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.slots s
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE s.merchant_id = v_merchant_id
    AND s.location_id = p_location_id
    AND s.deleted_at IS NULL
    AND (timezone(v_tz, s.start_time))::date >= (timezone(v_tz, now()))::date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
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
  v_tz text;
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

  SELECT COALESCE(l.time_zone, 'America/New_York')
  INTO v_tz
  FROM public.locations l
  WHERE l.id = p_location_id
    AND l.merchant_id = v_merchant_id;

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
    AND s.deleted_at IS NULL
    AND (timezone(v_tz, s.start_time))::date >= (timezone(v_tz, now()))::date;

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

GRANT EXECUTE ON FUNCTION public.preview_location_deletion_slots(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_upcoming_slots_at_location(uuid) TO authenticated;
