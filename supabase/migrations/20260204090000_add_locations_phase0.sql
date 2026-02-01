-- Phase 0: Add locations table + location_id wiring (no UI changes)

-- 1) Locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  time_zone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- RLS policy: merchants can manage own locations
DROP POLICY IF EXISTS "Merchants can manage own locations" ON public.locations;
CREATE POLICY "Merchants can manage own locations"
  ON public.locations FOR ALL
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_locations_merchant_id ON public.locations(merchant_id);

-- 2) Profiles: default_location_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- 3) Add location_id columns to location-scoped tables
ALTER TABLE public.slots
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.notify_requests
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.email_inbound_events
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.email_opening_confirmations
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.external_calendar_accounts
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.external_calendar_events
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.sms_intake_state
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- 4) Backfill default locations for existing profiles
INSERT INTO public.locations (merchant_id, name, address, phone, time_zone)
SELECT
  p.id,
  COALESCE(NULLIF(p.business_name, ''), 'Default Location'),
  p.address,
  p.phone,
  p.time_zone
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations l WHERE l.merchant_id = p.id
);

-- 5) Set default_location_id on profiles
UPDATE public.profiles p
SET default_location_id = l.id
FROM public.locations l
WHERE l.merchant_id = p.id
  AND p.default_location_id IS NULL;

-- 6) Backfill location_id columns
UPDATE public.slots s
SET location_id = p.default_location_id
FROM public.profiles p
WHERE s.merchant_id = p.id
  AND s.location_id IS NULL;

UPDATE public.staff s
SET location_id = p.default_location_id
FROM public.profiles p
WHERE s.merchant_id = p.id
  AND s.location_id IS NULL;

UPDATE public.notify_requests nr
SET location_id = p.default_location_id
FROM public.profiles p
WHERE nr.merchant_id = p.id
  AND nr.location_id IS NULL;

UPDATE public.qr_codes q
SET location_id = p.default_location_id
FROM public.profiles p
WHERE q.merchant_id = p.id
  AND q.location_id IS NULL;

UPDATE public.email_inbound_events e
SET location_id = p.default_location_id
FROM public.profiles p
WHERE e.merchant_id = p.id
  AND e.location_id IS NULL;

UPDATE public.email_opening_confirmations c
SET location_id = p.default_location_id
FROM public.profiles p
WHERE c.merchant_id = p.id
  AND c.location_id IS NULL;

UPDATE public.external_calendar_accounts a
SET location_id = p.default_location_id
FROM public.profiles p
WHERE a.merchant_id = p.id
  AND a.location_id IS NULL;

UPDATE public.external_calendar_events e
SET location_id = a.location_id
FROM public.external_calendar_accounts a
WHERE e.account_id = a.id
  AND e.location_id IS NULL;

UPDATE public.sms_intake_state s
SET location_id = p.default_location_id
FROM public.profiles p
WHERE s.merchant_id = p.id
  AND s.location_id IS NULL;

UPDATE public.sms_logs l
SET location_id = p.default_location_id
FROM public.profiles p
WHERE l.merchant_id = p.id
  AND l.location_id IS NULL;

-- 7) Indexes for location_id
CREATE INDEX IF NOT EXISTS idx_slots_location_id ON public.slots(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_location_id ON public.staff(location_id);
CREATE INDEX IF NOT EXISTS idx_notify_requests_location_id ON public.notify_requests(location_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_location_id ON public.qr_codes(location_id);
CREATE INDEX IF NOT EXISTS idx_email_inbound_events_location_id ON public.email_inbound_events(location_id);
CREATE INDEX IF NOT EXISTS idx_email_opening_confirmations_location_id ON public.email_opening_confirmations(location_id);
CREATE INDEX IF NOT EXISTS idx_calendar_accounts_location_id ON public.external_calendar_accounts(location_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_location_id ON public.external_calendar_events(location_id);
CREATE INDEX IF NOT EXISTS idx_sms_intake_state_location_id ON public.sms_intake_state(location_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_location_id ON public.sms_logs(location_id);

-- 8) Auto-create default location for new profiles
CREATE OR REPLACE FUNCTION public.create_default_location_for_profile()
RETURNS TRIGGER AS $$
DECLARE
  loc_id uuid;
BEGIN
  IF NEW.default_location_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO loc_id
  FROM public.locations
  WHERE merchant_id = NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF loc_id IS NULL THEN
    INSERT INTO public.locations (merchant_id, name, address, phone, time_zone)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.business_name, ''), 'Default Location'),
      NEW.address,
      NEW.phone,
      COALESCE(NEW.time_zone, 'America/New_York')
    )
    RETURNING id INTO loc_id;
  END IF;

  UPDATE public.profiles
  SET default_location_id = loc_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_default_location_on_profile_insert ON public.profiles;
CREATE TRIGGER create_default_location_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_location_for_profile();
