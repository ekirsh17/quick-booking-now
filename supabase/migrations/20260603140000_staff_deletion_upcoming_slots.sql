-- Preview and bulk soft-delete upcoming slots assigned to a staff member
-- (same calendar-date rule as location deletion, using staff location time zone).

CREATE OR REPLACE FUNCTION public.preview_staff_deletion_slots(p_staff_id uuid)
RETURNS TABLE(upcoming_count bigint)
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
  FROM public.staff st
  LEFT JOIN public.locations l ON l.id = st.location_id AND l.merchant_id = v_merchant_id
  WHERE st.id = p_staff_id
    AND st.merchant_id = v_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      COUNT(*) FILTER (
        WHERE (timezone(v_tz, s.start_time))::date >= (timezone(v_tz, now()))::date
      ),
      0
    )::bigint AS upcoming_count
  FROM public.slots s
  WHERE s.merchant_id = v_merchant_id
    AND s.staff_id = p_staff_id
    AND s.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_upcoming_slots_for_staff(p_staff_id uuid)
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
  FROM public.staff st
  LEFT JOIN public.locations l ON l.id = st.location_id AND l.merchant_id = v_merchant_id
  WHERE st.id = p_staff_id
    AND st.merchant_id = v_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.slots s
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE s.merchant_id = v_merchant_id
    AND s.staff_id = p_staff_id
    AND s.deleted_at IS NULL
    AND (timezone(v_tz, s.start_time))::date >= (timezone(v_tz, now()))::date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_staff_deletion_slots(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_upcoming_slots_for_staff(uuid) TO authenticated;
