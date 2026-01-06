-- Fix RLS policy to allow anonymous users to book slots
-- This allows consumers (anonymous users) to update slots from 'open'/'held' to 'booked'/'pending_confirmation'
-- The previous policy was missing 'pending_confirmation' in the WITH CHECK clause

-- Update the UPDATE policy to allow anonymous booking
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;

CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  status IN ('open', 'notified', 'held')  -- Allow status updates for available slots
)
WITH CHECK (
  merchant_id = auth.uid() OR
  status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation')  -- Allow status changes including booking
);

