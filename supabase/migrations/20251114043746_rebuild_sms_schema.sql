-- Phase 1: Database Schema & RLS for SMS Scheduling System
-- This migration sets up the foundation for the rebuilt SMS scheduling system

-- 1.1 Schema Enhancements

-- Add created_via enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE slot_created_via AS ENUM ('dashboard', 'sms', 'api');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add created_via column to slots table
ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS created_via slot_created_via DEFAULT 'dashboard';

-- Add time_zone column to slots table (for merchant context)
ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS time_zone text;

-- Add notes column to slots table (for cancellation/opening context)
ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS notes text;

-- 1.2 Create sms_intake_logs table for observability
CREATE TABLE IF NOT EXISTS public.sms_intake_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_number text NOT NULL,
  raw_message text NOT NULL,
  parsed_json jsonb,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  needs_clarification boolean DEFAULT false,
  clarification_question text,
  error_message text,
  opening_id uuid REFERENCES public.slots(id) ON DELETE SET NULL,
  processing_time_ms integer,
  operation text CHECK (operation IN ('add', 'cancel', 'edit', 'help', 'undo')),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for sms_intake_logs
CREATE INDEX IF NOT EXISTS idx_sms_intake_logs_merchant 
ON public.sms_intake_logs(merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_intake_logs_opening 
ON public.sms_intake_logs(opening_id);

CREATE INDEX IF NOT EXISTS idx_sms_intake_logs_from_number 
ON public.sms_intake_logs(from_number, created_at DESC);

-- 1.3 Update sms_intake_state table to match new schema
-- Drop existing table if it has wrong schema (we'll recreate it)
DROP TABLE IF EXISTS public.sms_intake_state CASCADE;

-- Create new sms_intake_state table with correct schema
CREATE TABLE public.sms_intake_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_number text NOT NULL,
  context jsonb NOT NULL, -- { original_message, parsed_data_so_far, merchant_context, round }
  round integer NOT NULL DEFAULT 1 CHECK (round >= 1 AND round <= 3),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_number) -- One active conversation per phone number
);

-- Create indexes for sms_intake_state
CREATE INDEX idx_sms_intake_state_expires 
ON public.sms_intake_state(expires_at);

CREATE INDEX idx_sms_intake_state_merchant_from 
ON public.sms_intake_state(merchant_id, from_number);

-- 1.4 RLS Policies

-- Enable RLS on new tables
ALTER TABLE public.sms_intake_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_intake_state ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive test policies on slots
DROP POLICY IF EXISTS "Allow all reads for testing" ON public.slots;
DROP POLICY IF EXISTS "Allow all writes for testing" ON public.slots;

-- Slots: Merchants can read/update their own slots via phone number matching
-- This allows merchants to see slots created via SMS even if auth.uid() doesn't match merchant_id
CREATE POLICY "Merchants can read own slots by phone"
ON public.slots
FOR SELECT
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- Slots: Merchants can insert their own slots
CREATE POLICY "Merchants can insert own slots"
ON public.slots
FOR INSERT
TO authenticated, anon
WITH CHECK (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- Slots: Merchants can update their own slots
CREATE POLICY "Merchants can update own slots"
ON public.slots
FOR UPDATE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
)
WITH CHECK (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- Slots: Merchants can delete their own slots (soft delete via status='cancelled')
CREATE POLICY "Merchants can delete own slots"
ON public.slots
FOR DELETE
TO authenticated, anon
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = slots.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- Profiles: Allow phone-based lookup for SMS flow (service role can read all)
-- Service role already has full access, but we need to allow anon/authenticated to read for phone lookups
CREATE POLICY "Allow phone-based profile lookup for SMS"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (
  id = auth.uid() OR
  phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
);

-- SMS intake logs: Merchants can read their own logs
CREATE POLICY "Merchants can read own SMS intake logs"
ON public.sms_intake_logs
FOR SELECT
TO authenticated
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = sms_intake_logs.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- SMS intake state: Service role can manage (for edge functions)
-- Allow service role full access, but also allow merchants to read their own state
CREATE POLICY "Service role can manage SMS intake state"
ON public.sms_intake_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Merchants can read own SMS intake state"
ON public.sms_intake_state
FOR SELECT
TO authenticated
USING (
  merchant_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = sms_intake_state.merchant_id
    AND (
      p.id = auth.uid() OR
      p.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- Add index for faster slot queries by merchant and time
CREATE INDEX IF NOT EXISTS idx_slots_merchant_start_time 
ON public.slots(merchant_id, start_time);

CREATE INDEX IF NOT EXISTS idx_slots_merchant_status 
ON public.slots(merchant_id, status);

-- Add index for finding slots by time window (for cancel/edit operations)
CREATE INDEX IF NOT EXISTS idx_slots_start_time 
ON public.slots(start_time);


