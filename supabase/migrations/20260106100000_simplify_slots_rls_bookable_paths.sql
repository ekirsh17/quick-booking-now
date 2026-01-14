-- Simplify slots RLS for anonymous/consumer booking
-- Ensures bookable statuses are reachable for both anon and authenticated users

-- Replace existing read/update policies with simpler, explicit variants
DROP POLICY IF EXISTS "Merchants can read own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;

-- Anyone can read bookable slots; merchants can read everything they own
CREATE POLICY "Merchants can read own slots"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  merchant_id = auth.uid()
  OR status IN ('open', 'notified', 'held')
);

-- Anyone can move bookable slots through the booking flow; merchants can do anything on their own slots
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  merchant_id = auth.uid()
  OR status IN ('open', 'notified', 'held', 'pending_confirmation')
)
WITH CHECK (
  merchant_id = auth.uid()
  OR status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation')
);
