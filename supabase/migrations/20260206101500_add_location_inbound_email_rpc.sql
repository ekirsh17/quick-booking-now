-- Phase 2: location-aware inbound email RPC

CREATE OR REPLACE FUNCTION ensure_location_inbound_email(p_location_id uuid)
RETURNS TABLE (
  inbound_email_token uuid,
  inbound_email_address text,
  inbound_email_status text,
  inbound_email_verified_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merchant_id uuid := auth.uid();
  token uuid;
  status text;
  verified_at timestamptz;
  loc_id uuid;
BEGIN
  IF merchant_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id, inbound_email_token, inbound_email_status, inbound_email_verified_at
    INTO loc_id, token, status, verified_at
    FROM public.locations
    WHERE id = p_location_id
      AND merchant_id = merchant_id;

  IF loc_id IS NULL THEN
    RAISE EXCEPTION 'location not found';
  END IF;

  IF token IS NULL THEN
    UPDATE public.locations
      SET inbound_email_token = gen_random_uuid(),
          inbound_email_status = 'pending'
      WHERE id = p_location_id
      RETURNING inbound_email_token, inbound_email_status, inbound_email_verified_at
        INTO token, status, verified_at;
  END IF;

  RETURN QUERY
    SELECT token,
           format('notify+%s@inbound.openalert.org', token),
           status,
           verified_at;
END;
$$;

REVOKE ALL ON FUNCTION ensure_location_inbound_email(uuid) FROM public;
GRANT EXECUTE ON FUNCTION ensure_location_inbound_email(uuid) TO authenticated;
