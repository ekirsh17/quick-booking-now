-- Add created_via column to slots table
DO $$ BEGIN
  CREATE TYPE slot_created_via AS ENUM ('dashboard', 'sms', 'api');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS created_via slot_created_via DEFAULT 'dashboard';

-- Add deleted_at column for soft-delete (undo feature)
ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add timezone column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS time_zone text DEFAULT 'America/New_York';

-- Create SMS intake state table for clarification flow
CREATE TABLE IF NOT EXISTS public.sms_intake_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(id),
  phone_number text NOT NULL,
  original_message text NOT NULL,
  parsed_data jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending_clarification',
  clarification_question text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT valid_state CHECK (state IN ('pending_clarification', 'resolved', 'expired'))
);

-- Enable RLS on sms_intake_state
ALTER TABLE public.sms_intake_state ENABLE ROW LEVEL SECURITY;

-- Merchants can view own intake state
CREATE POLICY "Merchants can view own intake state"
ON public.sms_intake_state
FOR SELECT
USING (auth.uid() = merchant_id);

-- Service role can manage intake state
CREATE POLICY "Service role can manage intake state"
ON public.sms_intake_state
FOR ALL
USING (true)
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_intake_state_merchant_phone 
ON public.sms_intake_state(merchant_id, phone_number, state);

-- Add index for cleanup
CREATE INDEX IF NOT EXISTS idx_sms_intake_state_expires 
ON public.sms_intake_state(expires_at);

-- Update slots view to exclude soft-deleted slots
CREATE OR REPLACE VIEW public.active_slots AS
SELECT * FROM public.slots
WHERE deleted_at IS NULL;