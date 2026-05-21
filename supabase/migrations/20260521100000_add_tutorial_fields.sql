ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_tour_seen_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tutorial_dismissed_at TIMESTAMPTZ DEFAULT NULL;

UPDATE public.profiles
SET
  tutorial_tour_seen_at = NOW(),
  tutorial_dismissed_at = NOW()
WHERE onboarding_completed_at IS NOT NULL
  AND tutorial_tour_seen_at IS NULL;
