-- Phase 2: per-location inbound email config

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS inbound_email_token UUID,
  ADD COLUMN IF NOT EXISTS inbound_email_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS inbound_email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inbound_email_last_received_at TIMESTAMPTZ;

-- Backfill default location from existing profile-level config
UPDATE public.locations l
SET inbound_email_token = p.inbound_email_token,
    inbound_email_status = p.inbound_email_status,
    inbound_email_verified_at = p.inbound_email_verified_at,
    inbound_email_last_received_at = p.inbound_email_last_received_at
FROM public.profiles p
WHERE l.id = p.default_location_id
  AND l.merchant_id = p.id
  AND p.inbound_email_token IS NOT NULL
  AND l.inbound_email_token IS NULL;

-- Unique index for token lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_inbound_email_token
  ON public.locations(inbound_email_token);
