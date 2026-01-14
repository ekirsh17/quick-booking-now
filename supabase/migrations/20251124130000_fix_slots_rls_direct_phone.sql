-- Alternative fix: Use a simpler RLS policy that doesn't require profile lookup
-- This policy directly checks if the authenticated user's phone matches any profile with that merchant_id
-- But we need to ensure profiles are readable first

-- Ensure profiles are readable (should already exist, but make sure)
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Drop and recreate the slots policy with a simpler check
-- The issue is that the EXISTS subquery might be failing due to RLS on profiles
-- So we'll use a function or a simpler approach
DROP POLICY IF EXISTS "Merchants can read own slots by phone" ON public.slots;

-- Create a policy that uses a security definer function to bypass RLS for the profile lookup
-- OR use a simpler direct check
CREATE POLICY "Merchants can read own slots by phone"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  -- Direct match
  merchant_id = auth.uid() OR
  -- Phone match: Check if any profile with this merchant_id has the same phone as the authenticated user
  -- Since "Anyone can view profiles" is now active, this should work
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = COALESCE(
      (SELECT phone FROM auth.users WHERE id = auth.uid()),
      ''
    )
    AND p.phone IS NOT NULL
    AND p.phone != ''
  )
);

-- Update other policies too
DROP POLICY IF EXISTS "Merchants can insert own slots" ON public.slots;
CREATE POLICY "Merchants can insert own slots"
ON public.slots
FOR INSERT
TO authenticated, anon
WITH CHECK (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = COALESCE(
      (SELECT phone FROM auth.users WHERE id = auth.uid()),
      ''
    )
    AND p.phone IS NOT NULL
    AND p.phone != ''
  )
);

DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = COALESCE(
      (SELECT phone FROM auth.users WHERE id = auth.uid()),
      ''
    )
    AND p.phone IS NOT NULL
    AND p.phone != ''
  )
)
WITH CHECK (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = COALESCE(
      (SELECT phone FROM auth.users WHERE id = auth.uid()),
      ''
    )
    AND p.phone IS NOT NULL
    AND p.phone != ''
  )
);

DROP POLICY IF EXISTS "Merchants can delete own slots" ON public.slots;
CREATE POLICY "Merchants can delete own slots"
ON public.slots
FOR DELETE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = COALESCE(
      (SELECT phone FROM auth.users WHERE id = auth.uid()),
      ''
    )
    AND p.phone IS NOT NULL
    AND p.phone != ''
  )
);












