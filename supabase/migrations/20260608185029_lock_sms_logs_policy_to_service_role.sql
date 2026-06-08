-- SEC-006: Restrict sms_logs access to service_role only.
DROP POLICY IF EXISTS "Service role can manage SMS logs" ON public.sms_logs;

CREATE POLICY "Service role can manage SMS logs"
  ON public.sms_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
