-- Fix the check_merchant_phone_match function to handle edge cases and add debugging
-- The function was returning false even when phones match, likely due to auth.uid() being NULL

DROP FUNCTION IF EXISTS public.check_merchant_phone_match(uuid);

CREATE OR REPLACE FUNCTION public.check_merchant_phone_match(p_merchant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_phone text;
  v_profile_phone text;
  v_user_id uuid;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- If no authenticated user, return false
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the authenticated user's phone
  SELECT phone INTO v_user_phone
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Get the profile's phone for the merchant_id
  SELECT phone INTO v_profile_phone
  FROM public.profiles
  WHERE id = p_merchant_id;
  
  -- Debug logging (will appear in Supabase logs)
  RAISE NOTICE 'check_merchant_phone_match: user_id=%, user_phone=%, profile_phone=%, merchant_id=%', 
    v_user_id, v_user_phone, v_profile_phone, p_merchant_id;
  
  -- Return true if phones match (and both are not null)
  RETURN (v_user_phone IS NOT NULL 
          AND v_profile_phone IS NOT NULL 
          AND v_user_phone = v_profile_phone);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE NOTICE 'check_merchant_phone_match error: %', SQLERRM;
    RETURN false;
END;
$$;

-- Test the function (this will show the debug output)
-- SELECT public.check_merchant_phone_match('64c4378e-34dd-4abf-b90e-c0ab7f861f6d'::uuid);



