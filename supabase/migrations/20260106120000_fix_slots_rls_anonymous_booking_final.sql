-- Fix slots RLS for anonymous booking - corrects USING clause and adds explicit NULL handling
-- The previous migration had 'pending_confirmation' in USING clause which is wrong (it's a target, not source)
-- Also adds explicit NULL handling for anonymous users to avoid NULL comparison issues

-- Drop existing policies
DROP POLICY IF EXISTS "Merchants can read own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;

-- SELECT: Allow reading bookable slots
-- Merchants can read all their own slots, anyone can read available/bookable slots
CREATE POLICY "Merchants can read own slots"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  -- Merchants can always read their own slots (any status)
  merchant_id = auth.uid()
  -- Anyone (including anonymous) can read slots that are available for booking
  OR status IN ('open', 'notified', 'held')
);

-- UPDATE: Allow booking transitions with explicit NULL handling
-- Merchants can update their own slots to any status
-- Anonymous and authenticated non-merchants can book available slots
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  -- Merchants can update their own slots (any status)
  merchant_id = auth.uid()
  -- Anonymous users can update slots that are available for booking
  OR (auth.uid() IS NULL AND status IN ('open', 'notified', 'held'))
  -- Authenticated non-merchants can also update available slots
  OR (auth.uid() IS NOT NULL AND merchant_id != auth.uid() AND status IN ('open', 'notified', 'held'))
)
WITH CHECK (
  -- Merchants can set any status on their own slots
  merchant_id = auth.uid()
  -- Anonymous users can book slots (transition to booked/pending_confirmation)
  OR (auth.uid() IS NULL AND status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'))
  -- Authenticated non-merchants can also book slots
  OR (auth.uid() IS NOT NULL AND merchant_id != auth.uid() AND status IN ('open', 'notified', 'held', 'booked', 'pending_confirmation'))
);

