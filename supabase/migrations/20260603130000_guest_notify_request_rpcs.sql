-- Guest waitlist: phone-verified notify_requests access (replaces permissive anon RLS)

CREATE OR REPLACE FUNCTION public.get_guest_notify_request(
  p_merchant_id uuid,
  p_location_id uuid,
  p_phone text
)
RETURNS TABLE (
  id uuid,
  time_range text,
  staff_id uuid,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    nr.id,
    nr.time_range,
    nr.staff_id,
    nr.created_at
  FROM public.notify_requests nr
  INNER JOIN public.consumers c ON c.id = nr.consumer_id
  WHERE nr.merchant_id = p_merchant_id
    AND nr.location_id = p_location_id
    AND c.phone = p_phone
    AND c.user_id IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_guest_notify_request(
  p_merchant_id uuid,
  p_location_id uuid,
  p_consumer_id uuid,
  p_phone text,
  p_time_range text,
  p_staff_id uuid,
  p_reset_created_at boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.consumers c
    WHERE c.id = p_consumer_id
      AND c.phone = p_phone
      AND c.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'consumer_verify_failed';
  END IF;

  SELECT nr.id
  INTO v_request_id
  FROM public.notify_requests nr
  WHERE nr.merchant_id = p_merchant_id
    AND nr.location_id = p_location_id
    AND nr.consumer_id = p_consumer_id
  LIMIT 1;

  IF v_request_id IS NOT NULL THEN
    UPDATE public.notify_requests
    SET
      time_range = p_time_range,
      staff_id = p_staff_id,
      created_at = CASE
        WHEN p_reset_created_at THEN now()
        ELSE created_at
      END
    WHERE id = v_request_id;

    RETURN v_request_id;
  END IF;

  INSERT INTO public.notify_requests (
    merchant_id,
    location_id,
    consumer_id,
    time_range,
    staff_id
  )
  VALUES (
    p_merchant_id,
    p_location_id,
    p_consumer_id,
    p_time_range,
    p_staff_id
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_notify_request(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_guest_notify_request(uuid, uuid, uuid, text, text, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_guest_notify_request(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_guest_notify_request(uuid, uuid, uuid, text, text, uuid, boolean) TO anon, authenticated;

DROP POLICY IF EXISTS "Guest consumers can update requests" ON public.notify_requests;
DROP POLICY IF EXISTS "Guest consumers can view requests" ON public.notify_requests;
DROP POLICY IF EXISTS "Guest consumers can delete requests" ON public.notify_requests;
