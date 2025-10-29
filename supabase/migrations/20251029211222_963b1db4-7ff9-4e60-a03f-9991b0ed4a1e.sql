-- Drop the old constraint
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_status_check;

-- Add new constraint with pending_confirmation
ALTER TABLE slots ADD CONSTRAINT slots_status_check 
CHECK (status = ANY (ARRAY['open'::text, 'notified'::text, 'held'::text, 'booked'::text, 'expired'::text, 'pending_confirmation'::text]));