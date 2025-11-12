-- Fix search_path for calendar credential encryption functions to include extensions schema

CREATE OR REPLACE FUNCTION public.encrypt_calendar_credentials(credentials_json jsonb, encryption_key text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN pgp_sym_encrypt(credentials_json::text, encryption_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_calendar_credentials(encrypted_data bytea, encryption_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key)::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;