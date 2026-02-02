-- Phase 1A: staff-aware notify_requests

ALTER TABLE public.notify_requests
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notify_requests_staff_id ON public.notify_requests(staff_id);

-- Backfill existing rows (explicitly set to NULL for clarity)
UPDATE public.notify_requests
SET staff_id = NULL
WHERE staff_id IS NULL;
