-- Persist merchant acknowledgment of forwarding verification (provider confirm step).

CREATE OR REPLACE FUNCTION acknowledge_inbound_email_verification()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merchant_id uuid := auth.uid();
  verified_at timestamptz;
BEGIN
  IF merchant_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
     SET inbound_email_verified_at = now()
   WHERE id = merchant_id
     AND inbound_email_status = 'verification_received'
  RETURNING inbound_email_verified_at INTO verified_at;

  IF verified_at IS NULL THEN
    SELECT profiles.inbound_email_verified_at
      INTO verified_at
      FROM public.profiles
     WHERE profiles.id = merchant_id;
  END IF;

  RETURN verified_at;
END;
$$;

REVOKE ALL ON FUNCTION acknowledge_inbound_email_verification() FROM public;
GRANT EXECUTE ON FUNCTION acknowledge_inbound_email_verification() TO authenticated;
