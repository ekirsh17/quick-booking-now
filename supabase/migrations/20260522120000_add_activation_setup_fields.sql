ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS setup_booking_method_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS setup_cancellation_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS setup_confirmation_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS setup_qr_engaged_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.setup_booking_method_confirmed_at IS 'Merchant saved booking method during activation setup.';
COMMENT ON COLUMN public.profiles.setup_cancellation_confirmed_at IS 'Merchant chose cancellation automation during activation setup.';
COMMENT ON COLUMN public.profiles.setup_confirmation_confirmed_at IS 'Merchant saved confirmation rules during activation setup.';
COMMENT ON COLUMN public.profiles.setup_qr_engaged_at IS 'Merchant viewed, copied, or downloaded waitlist QR during activation setup.';
