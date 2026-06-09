-- SEC-002: Restrict consumers table access to scoped owner/merchant policies and RPC paths.
-- Keep authenticated owner reads/updates, remove permissive anon access.

DROP POLICY IF EXISTS "Consumers can view own data" ON public.consumers;
DROP POLICY IF EXISTS "Anyone can create consumer" ON public.consumers;

CREATE POLICY "Users can create own consumer data"
  ON public.consumers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants can view consumers on own notify requests"
  ON public.consumers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.notify_requests nr
      WHERE nr.consumer_id = consumers.id
        AND nr.merchant_id = auth.uid()
    )
  );

-- Minimal lookup for sign-in and guest waitlist flows.
CREATE OR REPLACE FUNCTION public.get_consumer_auth_status(
  p_phone text
)
RETURNS TABLE (
  consumer_id uuid,
  consumer_name text,
  has_account boolean,
  booking_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    c.id AS consumer_id,
    c.name AS consumer_name,
    (c.user_id IS NOT NULL) AS has_account,
    COALESCE(c.booking_count, 0) AS booking_count
  FROM public.consumers c
  WHERE c.phone = p_phone
  LIMIT 1;
$$;

-- Guest-only create path (table INSERT no longer open to anon clients).
CREATE OR REPLACE FUNCTION public.create_guest_consumer_profile(
  p_phone text,
  p_name text,
  p_saved_info boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consumer_id uuid;
BEGIN
  IF trim(COALESCE(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  IF trim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  INSERT INTO public.consumers (
    name,
    phone,
    saved_info
  )
  VALUES (
    trim(p_name),
    p_phone,
    COALESCE(p_saved_info, false)
  )
  RETURNING id INTO v_consumer_id;

  RETURN v_consumer_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT c.id
    INTO v_consumer_id
    FROM public.consumers c
    WHERE c.phone = p_phone
    LIMIT 1;

    IF v_consumer_id IS NULL THEN
      RAISE EXCEPTION 'consumer_create_failed';
    END IF;

    RETURN v_consumer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_consumer_auth_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_guest_consumer_profile(text, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_consumer_auth_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_consumer_profile(text, text, boolean) TO anon, authenticated;
