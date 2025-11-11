-- Revert to checking conflicts for all slots including unassigned (no duplicates)
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
  -- Check for exact time match (prevent duplicates)
  IF EXISTS (
    SELECT 1
    FROM public.slots
    WHERE merchant_id = p_merchant_id
      AND (staff_id = p_staff_id OR (staff_id IS NULL AND p_staff_id IS NULL))
      AND id != COALESCE(p_slot_id, gen_random_uuid())
      AND start_time = p_start_time
      AND end_time = p_end_time
      AND status != 'cancelled'
      AND deleted_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check for overlapping time (conflict)
  RETURN EXISTS (
    SELECT 1
    FROM public.slots
    WHERE merchant_id = p_merchant_id
      AND (staff_id = p_staff_id OR (staff_id IS NULL AND p_staff_id IS NULL))
      AND id != COALESCE(p_slot_id, gen_random_uuid())
      AND (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      AND status != 'cancelled'
      AND deleted_at IS NULL
  );
END;
$function$;