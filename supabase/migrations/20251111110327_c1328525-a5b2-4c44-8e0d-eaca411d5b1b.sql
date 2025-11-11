-- Drop the security definer view and let clients filter deleted_at instead
DROP VIEW IF EXISTS public.active_slots;