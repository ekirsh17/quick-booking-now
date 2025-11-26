-- Fix RLS policy using a security definer function to bypass RLS for profile lookup
-- This ensures the profile lookup works even if there are RLS issues

-- Create a function that checks if a merchant_id matches the authenticated user's phone
-- This function runs with SECURITY DEFINER to bypass RLS on profiles
CREATE OR REPLACE FUNCTION public.check_merchant_phone_match(p_merchant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_phone text;
  v_profile_phone text;
BEGIN
  -- Get the authenticated user's phone
  SELECT phone INTO v_user_phone
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Get the profile's phone for the merchant_id
  SELECT phone INTO v_profile_phone
  FROM public.profiles
  WHERE id = p_merchant_id;
  
  -- Return true if phones match (and both are not null)
  RETURN (v_user_phone IS NOT NULL 
          AND v_profile_phone IS NOT NULL 
          AND v_user_phone = v_profile_phone);
END;
$$;

-- Ensure profiles are readable (should already exist, but make sure)
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Drop and recreate the slots policy using the function
DROP POLICY IF EXISTS "Merchants can read own slots by phone" ON public.slots;

CREATE POLICY "Merchants can read own slots by phone"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  public.check_merchant_phone_match(merchant_id) = true
);

-- Update other policies too
DROP POLICY IF EXISTS "Merchants can insert own slots" ON public.slots;
CREATE POLICY "Merchants can insert own slots"
ON public.slots
FOR INSERT
TO authenticated, anon
WITH CHECK (
  merchant_id = auth.uid() OR
  public.check_merchant_phone_match(merchant_id) = true
);

DROP POLICY IF EXISTS "Merchants can update own slots" ON public.slots;
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  public.check_merchant_phone_match(merchant_id) = true
)
WITH CHECK (
  merchant_id = auth.uid() OR
  public.check_merchant_phone_match(merchant_id) = true
);

DROP POLICY IF EXISTS "Merchants can delete own slots" ON public.slots;
CREATE POLICY "Merchants can delete own slots"
ON public.slots
FOR DELETE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  public.check_merchant_phone_match(merchant_id) = true
);




