-- Fix RLS policies for slots to avoid direct auth.users access
-- The previous migration tried to JOIN auth.users directly in RLS policies, which fails
-- This migration simplifies the policies to only check merchant_id = auth.uid()

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Merchants can read own slots by phone" ON public.slots;
DROP POLICY IF EXISTS "Merchants can insert own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can delete own slots" ON public.slots;
DROP POLICY IF EXISTS "Merchants can manage own slots" ON public.slots;
DROP POLICY IF EXISTS "Anyone can view available slots" ON public.slots;
DROP POLICY IF EXISTS "Anyone can update slot status" ON public.slots;

-- Create simplified policies that only check merchant_id = auth.uid()
-- This works because the frontend always sets merchant_id to user.id (auth.uid())

-- SELECT: Allow merchants to read their own slots, or anyone to view available slots
CREATE POLICY "Merchants can read own slots"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  status IN ('open', 'notified')  -- Allow public viewing of available slots
);

-- INSERT: Only allow merchants to insert slots for themselves
CREATE POLICY "Merchants can insert own slots"
ON public.slots
FOR INSERT
TO authenticated
WITH CHECK (merchant_id = auth.uid());

-- UPDATE: Allow merchants to update their own slots, or anyone to update status
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
  status IN ('open', 'notified', 'held', 'booked')  -- Allow status changes
);

-- DELETE: Only allow merchants to delete their own slots
CREATE POLICY "Merchants can delete own slots"
ON public.slots
FOR DELETE
TO authenticated
USING (merchant_id = auth.uid());

