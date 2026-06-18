ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_count text;
