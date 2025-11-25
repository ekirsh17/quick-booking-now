-- Fix RLS policy for slots to allow phone-based access
-- The current policy requires a profile lookup which fails due to RLS on profiles
-- This migration ensures the profiles table is readable for the phone check

-- First, ensure profiles can be read for phone matching (needed for the slots policy)
-- The "Anyone can view profiles" policy should already exist from the previous migration
-- But let's make sure it's there and active
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Now fix the slots policy to use phone matching
DROP POLICY IF EXISTS "Merchants can read own slots by phone" ON public.slots;

-- Create a policy that allows access if:
-- 1. merchant_id matches auth.uid() (direct match)
-- 2. OR the authenticated user's phone matches the profile's phone for that merchant_id
CREATE POLICY "Merchants can read own slots by phone"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  )
);

-- Also update the other slot policies to use the same pattern
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
    AND p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
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
    AND p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  )
)
WITH CHECK (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
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
    AND p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  )
);

