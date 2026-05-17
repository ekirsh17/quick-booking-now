-- Enforce global seat limit (seats_count) on public.staff so every code path
-- (direct INSERT, RPCs, future paths) is gated atomically. Mirrors the rule
-- already used by create_location_with_initial_staff but applies it generally.

CREATE OR REPLACE FUNCTION public.enforce_seat_limit_on_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats_total integer;
  v_unlimited_staff boolean;
  v_active_count integer;
  v_subscription_found boolean := false;
BEGIN
  -- Only enforce when the row is/became active. Soft-delete or inactivation
  -- can never increase seat usage.
  IF NEW.active IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- Match the source-of-truth used by create_location_with_initial_staff and
  -- useSubscription: most recent subscription's seats_count and plan flags.
  SELECT
    COALESCE(s.seats_count, 1),
    COALESCE(p.is_unlimited_staff, false),
    true
  INTO
    v_seats_total,
    v_unlimited_staff,
    v_subscription_found
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.merchant_id = NEW.merchant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Bootstrap path: brand-new merchants may not have a subscription row yet
  -- (e.g. create_default_location_for_profile inserts a primary staff during
  -- profile creation). Don't block that path.
  IF NOT v_subscription_found THEN
    RETURN NULL;
  END IF;

  IF COALESCE(v_unlimited_staff, false) THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.staff
  WHERE merchant_id = NEW.merchant_id
    AND COALESCE(active, true) = true;

  IF v_active_count > COALESCE(v_seats_total, 1) THEN
    RAISE EXCEPTION 'SEAT_LIMIT_REACHED: merchant % has % active staff but only % seat(s) available',
      NEW.merchant_id, v_active_count, v_seats_total
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_seat_limit_on_staff ON public.staff;
CREATE TRIGGER trg_enforce_seat_limit_on_staff
AFTER INSERT OR UPDATE OF active ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.enforce_seat_limit_on_staff();
