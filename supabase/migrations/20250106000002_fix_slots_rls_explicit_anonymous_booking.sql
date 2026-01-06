-- Fix RLS policy to explicitly allow anonymous users to book slots
-- The previous policy failed because auth.uid() IS NULL for anonymous users,
-- and the condition merchant_id = auth.uid() evaluates to NULL (not true/false)
-- This migration adds explicit NULL handling to make the policy work for anonymous users

-- Update the UPDATE policy with explicit NULL handling
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;

CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  -- Merchants can update their own slots
  merchant_id = auth.uid() OR
  -- Anonymous users can update slots that are available (open, notified, held)
  (auth.uid() IS NULL AND status IN ('open', 'notified', 'held'))
)
WITH CHECK (
  -- Merchants can update their own slots to any status
  merchant_id = auth.uid() OR
  -- Anonymous users can book slots (change status to booked/pending_confirmation)
  (auth.uid() IS NULL AND status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'))
);

