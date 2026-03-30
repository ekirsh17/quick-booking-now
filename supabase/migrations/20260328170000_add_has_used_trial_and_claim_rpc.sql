ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_used_trial boolean NOT NULL DEFAULT false;

UPDATE public.profiles AS p
SET has_used_trial = true
FROM public.subscriptions AS s
WHERE s.merchant_id = p.id
  AND (
    s.trial_start IS NOT NULL
    OR s.trial_end IS NOT NULL
    OR s.trial_ended_reason IS NOT NULL
    OR COALESCE(s.openings_filled_during_trial, 0) > 0
    OR s.status = 'trialing'
  );

CREATE OR REPLACE FUNCTION public.claim_one_time_trial_eligibility(p_merchant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET has_used_trial = true
  WHERE id = p_merchant_id
    AND COALESCE(has_used_trial, false) = false;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_one_time_trial_eligibility(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_one_time_trial_eligibility(uuid) TO service_role;
