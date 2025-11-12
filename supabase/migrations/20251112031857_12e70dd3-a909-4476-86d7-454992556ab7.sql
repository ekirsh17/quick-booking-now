-- Fix security warnings: Set proper search_path for encryption functions

-- Drop and recreate encrypt function with proper search_path
DROP FUNCTION IF EXISTS encrypt_calendar_credentials(JSONB, TEXT);
CREATE OR REPLACE FUNCTION encrypt_calendar_credentials(credentials_json JSONB, encryption_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN pgp_sym_encrypt(credentials_json::text, encryption_key);
END;
$$;

-- Drop and recreate decrypt function with proper search_path  
DROP FUNCTION IF EXISTS decrypt_calendar_credentials(BYTEA, TEXT);
CREATE OR REPLACE FUNCTION decrypt_calendar_credentials(encrypted_data BYTEA, encryption_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key)::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;