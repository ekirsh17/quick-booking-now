-- SEC-002: Restrict otp_codes access to service_role only.
DROP POLICY IF EXISTS "Anyone can request OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can verify OTP codes" ON public.otp_codes;

CREATE POLICY "Service role can manage OTP codes"
  ON public.otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
