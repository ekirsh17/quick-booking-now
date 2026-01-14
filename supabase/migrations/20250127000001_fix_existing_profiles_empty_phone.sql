-- Fix existing profiles that have empty phone numbers
-- Updates profiles where phone is NULL or empty string, but the auth user has a phone number
-- This fixes profiles created before the handle_new_user fix

UPDATE public.profiles p
SET phone = u.phone
FROM auth.users u
WHERE p.id = u.id
  AND (p.phone IS NULL OR p.phone = '')
  AND u.phone IS NOT NULL
  AND u.phone != '';

-- Log how many profiles were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % profile(s) with phone numbers from auth.users', updated_count;
END $$;






