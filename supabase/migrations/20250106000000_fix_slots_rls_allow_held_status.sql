-- Fix RLS policy to allow anonymous users to read slots with 'held' status
-- This allows consumers to view slots that are temporarily held (within the 3-minute hold window)
-- The previous policy only allowed 'open' and 'notified' statuses, which caused 404 errors
-- when consumers clicked booking links for slots that were in 'held' status

-- Update the SELECT policy to include 'held' status
DROP POLICY IF EXISTS "Merchants can read own slots" ON public.slots;

CREATE POLICY "Merchants can read own slots"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  status IN ('open', 'notified', 'held')  -- Allow public viewing of available and held slots
);

