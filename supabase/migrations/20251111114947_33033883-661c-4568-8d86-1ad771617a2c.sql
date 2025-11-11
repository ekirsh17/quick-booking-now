-- Allow multiple unassigned (no staff) openings by skipping conflict checks when p_staff_id is NULL
CREATE OR REPLACE FUNCTION public.check_slot_conflict(
  p_merchant_id uuid,
  p_staff_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_slot_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If no staff is specified, allow overlapping openings (support capacity-style behavior)
  IF p_staff_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.slots
    WHERE merchant_id = p_merchant_id
      AND staff_id = p_staff_id
      AND id != COALESCE(p_slot_id, gen_random_uuid())
      AND (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      AND status != 'cancelled'
      AND deleted_at IS NULL
  );
END;
$function$;