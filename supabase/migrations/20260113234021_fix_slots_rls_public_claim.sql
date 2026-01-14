-- Allow public users to claim open/notified/held slots
-- Ensures booking updates work for anonymous consumers

DROP POLICY IF EXISTS "public_can_update_bookable_slots" ON public.slots;

CREATE POLICY "public_can_update_bookable_slots"
ON public.slots
FOR UPDATE
USING (status IN ('open', 'notified', 'held'))
WITH CHECK (status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'));
