-- Add intermediate status for external booking flows.
ALTER TABLE public.slots DROP CONSTRAINT IF EXISTS slots_status_check;

ALTER TABLE public.slots
ADD CONSTRAINT slots_status_check
CHECK (
  status = ANY (
    ARRAY[
      'open'::text,
      'notified'::text,
      'held'::text,
      'booked'::text,
      'expired'::text,
      'pending_confirmation'::text,
      'pending_external_booking'::text
    ]
  )
);
