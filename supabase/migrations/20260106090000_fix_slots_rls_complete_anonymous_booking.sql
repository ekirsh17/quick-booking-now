-- Fix slots RLS to fully support anonymous booking flow
-- Restores held/pending_confirmation access and explicit NULL handling

-- Drop existing policies so we can recreate with corrected logic
DROP POLICY IF EXISTS "Merchants can read own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;

-- Allow merchants full access to their own slots and allow public visibility of bookable slots
CREATE POLICY "Merchants can read own slots"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  -- Merchants can always read their own slots
  merchant_id = auth.uid()
  -- Anyone (including anonymous) can read slots that are available or in-progress
  OR (auth.uid() IS NULL AND status IN ('open', 'notified', 'held'))
  OR (auth.uid() IS NOT NULL AND status IN ('open', 'notified', 'held'))
);

-- Allow merchants to update their own slots and allow public booking transitions
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  -- Merchants can always update their own slots
  merchant_id = auth.uid()
  -- Anyone (including anonymous) can update while the slot is available/in-progress
  OR (auth.uid() IS NULL AND status IN ('open', 'notified', 'held'))
  OR (auth.uid() IS NOT NULL AND status IN ('open', 'notified', 'held'))
)
WITH CHECK (
  -- Merchants can set any status on their own slots
  merchant_id = auth.uid()
  -- Public (including anonymous) can move slots through the booking flow
  OR (auth.uid() IS NULL AND status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'))
  OR (auth.uid() IS NOT NULL AND status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'))
);
