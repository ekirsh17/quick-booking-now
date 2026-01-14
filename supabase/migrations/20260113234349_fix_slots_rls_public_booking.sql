-- Reset slot UPDATE policies to allow public booking while preserving merchant control

-- Drop legacy/conflicting UPDATE policies
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can manage own slots" ON public.slots;
DROP POLICY IF EXISTS "Anyone can update slot status" ON public.slots;
DROP POLICY IF EXISTS "public_can_update_bookable_slots" ON public.slots;

-- Merchants can update their own slots to any status
CREATE POLICY "slots_update_merchant"
ON public.slots
FOR UPDATE
TO authenticated
USING (merchant_id = auth.uid())
WITH CHECK (merchant_id = auth.uid());

-- Public can claim open/notified/held slots (transition to booked/pending_confirmation)
CREATE POLICY "slots_update_public_booking"
ON public.slots
FOR UPDATE
TO anon, authenticated
USING (status IN ('open', 'notified', 'held'))
WITH CHECK (status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'));
