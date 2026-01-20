ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS business_type_other text,
  ADD COLUMN IF NOT EXISTS weekly_appointments text,
  ADD COLUMN IF NOT EXISTS team_size text;
