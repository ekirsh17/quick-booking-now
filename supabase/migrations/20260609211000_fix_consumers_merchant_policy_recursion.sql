-- Fix SEC-002 follow-up: avoid recursive RLS evaluation when merchants read waitlist consumers.
-- The prior policy queried notify_requests directly, which recursively triggered consumers policies.

DROP POLICY IF EXISTS "Merchants can view consumers on own notify requests" ON public.consumers;

CREATE OR REPLACE FUNCTION public.merchant_can_view_consumer(
  p_consumer_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notify_requests nr
    WHERE nr.consumer_id = p_consumer_id
      AND nr.merchant_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.merchant_can_view_consumer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_can_view_consumer(uuid) TO authenticated;

CREATE POLICY "Merchants can view consumers on own notify requests"
  ON public.consumers
  FOR SELECT
  TO authenticated
  USING (public.merchant_can_view_consumer(consumers.id));
