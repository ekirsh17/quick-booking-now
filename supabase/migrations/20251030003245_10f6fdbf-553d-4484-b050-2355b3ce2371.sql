-- Update handle_new_user trigger to support both merchant and consumer types
-- Only creates profile for merchants, consumers will be created manually after signup
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
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'address', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;