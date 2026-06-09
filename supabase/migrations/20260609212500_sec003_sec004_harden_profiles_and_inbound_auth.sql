-- SEC-003: Restrict direct profile exposure and replace with constrained RPCs.

-- Remove broad public profile read paths.
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "anon_read_profile_by_handle" ON public.profiles;
DROP POLICY IF EXISTS "Allow phone-based profile lookup for SMS" ON public.profiles;

-- Keep authenticated merchants able to read only their own row.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Public-safe merchant profile fields for consumer pages.
CREATE OR REPLACE FUNCTION public.get_public_merchant_profile(
  p_merchant_id uuid
)
RETURNS TABLE (
  merchant_id uuid,
  business_name text,
  booking_url text,
  default_location_id uuid,
  phone text,
  address text,
  time_zone text,
  require_confirmation boolean,
  use_booking_system boolean,
  booking_notifications_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS merchant_id,
    p.business_name,
    p.booking_url,
    p.default_location_id,
    p.phone,
    p.address,
    p.time_zone,
    p.require_confirmation,
    p.use_booking_system,
    COALESCE(p.booking_notifications_enabled, false) AS booking_notifications_enabled
  FROM public.profiles p
  WHERE p.id = p_merchant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_merchant_profile(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_merchant_profile(uuid) TO anon, authenticated;

-- Batch-safe merchant identity data for consumer history screens.
CREATE OR REPLACE FUNCTION public.get_public_merchants_basic(
  p_merchant_ids uuid[]
)
RETURNS TABLE (
  merchant_id uuid,
  business_name text,
  time_zone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS merchant_id,
    p.business_name,
    p.time_zone
  FROM public.profiles p
  WHERE p_merchant_ids IS NOT NULL
    AND p.id = ANY (p_merchant_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_merchants_basic(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_merchants_basic(uuid[]) TO anon, authenticated;

-- Authenticated-only handle availability checker.
CREATE OR REPLACE FUNCTION public.is_handle_available(
  p_handle text,
  p_exclude_merchant_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.handle = lower(trim(coalesce(p_handle, '')))
      AND (p_exclude_merchant_id IS NULL OR p.id <> p_exclude_merchant_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_handle_available(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_handle_available(text, uuid) TO authenticated;

-- Authenticated-only onboarding dedupe lookup.
CREATE OR REPLACE FUNCTION public.find_profile_by_email_for_onboarding(
  p_email text,
  p_current_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.phone
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.email IS NOT NULL
    AND lower(p.email) = lower(trim(coalesce(p_email, '')))
    AND p.phone IS NOT NULL
    AND (p_current_user_id IS NULL OR p.id <> p_current_user_id)
  ORDER BY p.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_profile_by_email_for_onboarding(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.find_profile_by_email_for_onboarding(text, uuid) TO authenticated;

-- Ensure public RPC permissions are explicit.
REVOKE ALL ON FUNCTION public.get_public_staff(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_staff(uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_location(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_location(uuid, uuid) TO anon, authenticated;
