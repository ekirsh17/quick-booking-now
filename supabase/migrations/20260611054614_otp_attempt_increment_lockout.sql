-- SEC-006: Atomically increment OTP attempts on failed verification.
CREATE OR REPLACE FUNCTION public.increment_otp_attempts(p_otp_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  UPDATE public.otp_codes
  SET attempts = attempts + 1
  WHERE id = p_otp_id
    AND verified = false
    AND expires_at > now()
    AND attempts < 3
  RETURNING attempts INTO v_attempts;

  IF v_attempts IS NULL THEN
    SELECT attempts
    INTO v_attempts
    FROM public.otp_codes
    WHERE id = p_otp_id;
  END IF;

  RETURN COALESCE(v_attempts, 3);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_otp_attempts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_otp_attempts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_otp_attempts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_otp_attempts(uuid) TO service_role;
