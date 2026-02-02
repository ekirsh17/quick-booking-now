-- Phase 1D: Backfill missing staff.location_id to merchant default location
UPDATE public.staff s
SET location_id = p.default_location_id
FROM public.profiles p
WHERE s.merchant_id = p.id
  AND s.location_id IS NULL
  AND p.default_location_id IS NOT NULL;
