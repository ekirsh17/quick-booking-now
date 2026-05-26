-- Migration: add booking_notifications_enabled to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS booking_notifications_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.booking_notifications_enabled IS
  'When true, merchant receives an SMS when a consumer directly books an opening (only applies when use_booking_system is false)';
