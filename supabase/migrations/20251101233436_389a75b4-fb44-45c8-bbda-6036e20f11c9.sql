-- PHASE 1: CRITICAL SECURITY & DATA INTEGRITY FIXES

-- 1.1: Fix RLS Policies for notifications table
-- Allow service role (edge functions) to insert notifications
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- 1.2: Prevent Duplicate Notifications (same slot + consumer)
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_slot_consumer_unique 
UNIQUE (slot_id, consumer_id);

-- 1.3: Prevent Duplicate Notify Requests (same merchant + consumer)
ALTER TABLE public.notify_requests
ADD CONSTRAINT notify_requests_merchant_consumer_unique 
UNIQUE (merchant_id, consumer_id);

-- 1.4: Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule OTP cleanup to run every hour
SELECT cron.schedule(
  'cleanup-expired-otps',
  '0 * * * *', -- Every hour at :00
  $$
  SELECT public.cleanup_expired_otps();
  $$
);

-- 1.6: Create Idempotency Table for Notification Deduplication
CREATE TABLE public.notification_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  slot_id uuid NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL REFERENCES public.consumers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  response_data jsonb
);

-- Enable RLS on idempotency table
ALTER TABLE public.notification_idempotency ENABLE ROW LEVEL SECURITY;

-- Only service role can manage idempotency records
CREATE POLICY "Service role can manage idempotency"
ON public.notification_idempotency
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_notification_idempotency_key 
ON public.notification_idempotency(idempotency_key);

CREATE INDEX idx_notification_idempotency_slot_consumer 
ON public.notification_idempotency(slot_id, consumer_id);