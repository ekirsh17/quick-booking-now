-- Simplified RLS policy that directly checks phone matching without a function
-- This should work more reliably

-- Ensure profiles are readable
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Drop the existing policy
DROP POLICY IF EXISTS "Merchants can read own slots by phone" ON public.slots;

-- Create a simpler policy that directly checks phone matching
-- This uses a subquery that should work with the "Anyone can view profiles" policy
CREATE POLICY "Merchants can read own slots by phone"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  -- Direct match: merchant_id equals auth.uid()
  merchant_id = auth.uid() OR
  -- Phone match: Check if the profile's phone matches the authenticated user's phone
  (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = slots.merchant_id
    )
    AND
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      INNER JOIN auth.users u ON u.id = auth.uid()
      WHERE p.id = slots.merchant_id
      AND p.phone = u.phone
      AND u.phone IS NOT NULL
      AND p.phone IS NOT NULL
    )
  )
);

-- Update other policies with the same pattern
DROP POLICY IF EXISTS "Merchants can insert own slots" ON public.slots;
CREATE POLICY "Merchants can insert own slots"
ON public.slots
FOR INSERT
TO authenticated, anon
WITH CHECK (
  merchant_id = auth.uid() OR
  (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = slots.merchant_id
    )
    AND
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      INNER JOIN auth.users u ON u.id = auth.uid()
      WHERE p.id = slots.merchant_id
      AND p.phone = u.phone
      AND u.phone IS NOT NULL
      AND p.phone IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = slots.merchant_id
    )
    AND
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      INNER JOIN auth.users u ON u.id = auth.uid()
      WHERE p.id = slots.merchant_id
      AND p.phone = u.phone
      AND u.phone IS NOT NULL
      AND p.phone IS NOT NULL
    )
  )
)
WITH CHECK (
  merchant_id = auth.uid() OR
  (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = slots.merchant_id
    )
    AND
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      INNER JOIN auth.users u ON u.id = auth.uid()
      WHERE p.id = slots.merchant_id
      AND p.phone = u.phone
      AND u.phone IS NOT NULL
      AND p.phone IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Merchants can delete own slots" ON public.slots;
CREATE POLICY "Merchants can delete own slots"
ON public.slots
FOR DELETE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = slots.merchant_id
    )
    AND
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      INNER JOIN auth.users u ON u.id = auth.uid()
      WHERE p.id = slots.merchant_id
      AND p.phone = u.phone
      AND u.phone IS NOT NULL
      AND p.phone IS NOT NULL
    )
  )
);

