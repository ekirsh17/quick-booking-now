-- Phase 2: public location lookup for consumer notify flow
CREATE OR REPLACE FUNCTION public.get_public_location(
  p_merchant_id uuid,
  p_location_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  phone text,
  time_zone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.name, l.address, l.phone, l.time_zone
  FROM public.locations l
  WHERE l.merchant_id = p_merchant_id
    AND l.id = p_location_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_location(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_location(uuid, uuid) TO anon, authenticated;
