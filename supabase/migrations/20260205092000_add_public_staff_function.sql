-- Phase 1D: Public staff lookup for consumer flows (returns only id + name)
CREATE OR REPLACE FUNCTION public.get_public_staff(
  p_merchant_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  location_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.location_id
  FROM public.staff s
  WHERE s.merchant_id = p_merchant_id
    AND s.active = true
    AND (p_location_id IS NULL OR s.location_id = p_location_id)
  ORDER BY s.created_at ASC;
$$;
