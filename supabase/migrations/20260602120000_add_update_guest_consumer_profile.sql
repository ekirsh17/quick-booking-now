-- Allow guest waitlist resubmits to update consumer name (phone must match row)
CREATE OR REPLACE FUNCTION public.update_guest_consumer_profile(
  p_consumer_id uuid,
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
  v_id uuid;
BEGIN
  UPDATE public.consumers
  SET
    name = trim(p_name),
    saved_info = coalesce(p_saved_info, false)
  WHERE id = p_consumer_id
    AND phone = p_phone
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'consumer_update_failed';
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_guest_consumer_profile(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_guest_consumer_profile(uuid, text, text, boolean) TO anon, authenticated;
