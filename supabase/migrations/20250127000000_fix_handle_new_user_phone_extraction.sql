-- Fix handle_new_user function to extract phone from auth.users.phone
-- ROOT CAUSE: verify-otp sets phone in auth.users.phone, but handle_new_user
-- was only checking raw_user_meta_data->>'phone', resulting in empty phone strings
-- in profiles table, causing SMS parsing to fail.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only create profile if user_type is merchant or not specified (backward compatibility)
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'merchant') = 'merchant' THEN
    INSERT INTO public.profiles (id, business_name, phone, address)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
      -- FIX: Use NEW.phone (from auth.users.phone) as fallback when raw_user_meta_data doesn't have it
      -- This fixes the issue where verify-otp creates users with phone in auth.users.phone
      -- but not in raw_user_meta_data, causing profiles to be created with empty phone strings
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'phone', ''),  -- Try raw_user_meta_data first
        NEW.phone,  -- Fallback to auth.users.phone (this is the key fix)
        ''
      ),
      COALESCE(NEW.raw_user_meta_data->>'address', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;






