-- SEC-007: Restrict external_calendar_events management to service_role only.
DROP POLICY IF EXISTS "Service role can manage calendar events" ON public.external_calendar_events;

CREATE POLICY "Service role can manage calendar events"
  ON public.external_calendar_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
