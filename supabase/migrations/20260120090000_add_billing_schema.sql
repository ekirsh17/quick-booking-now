-- Billing schema: plans, subscriptions, billing events, sms usage, and helper functions

-- Plans
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_price integer NOT NULL,
  annual_price integer,
  display_order integer DEFAULT 0,
  features jsonb,
  is_active boolean DEFAULT true,
  staff_included integer NOT NULL DEFAULT 1,
  staff_addon_price integer,
  max_staff integer,
  is_unlimited_staff boolean DEFAULT false,
  sms_included integer DEFAULT 300,
  sms_overage_price_per_100 integer DEFAULT 200,
  is_unlimited_sms boolean DEFAULT false,
  stripe_product_id text,
  stripe_price_id text,
  stripe_annual_price_id text,
  paypal_plan_id text,
  paypal_annual_plan_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans are readable by anyone" ON public.plans;
CREATE POLICY "Plans are readable by anyone"
  ON public.plans FOR SELECT
  USING (true);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id text REFERENCES public.plans(id),
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status text DEFAULT 'trialing',
  trial_start timestamptz,
  trial_end timestamptz,
  trial_ended_reason text,
  openings_filled_during_trial integer DEFAULT 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  paused_at timestamptz,
  pause_resumes_at timestamptz,
  seats_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_customer_id
  ON public.subscriptions(provider_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON public.subscriptions(provider_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view own subscription" ON public.subscriptions;
CREATE POLICY "Merchants can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = merchant_id);

DROP POLICY IF EXISTS "Merchants can create own subscription" ON public.subscriptions;
CREATE POLICY "Merchants can create own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

DROP POLICY IF EXISTS "Merchants can update own subscription" ON public.subscriptions;
CREATE POLICY "Merchants can update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = merchant_id);

-- Billing events
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  provider text,
  provider_event_id text,
  merchant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payload jsonb,
  processed boolean DEFAULT true,
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- SMS usage
CREATE TABLE IF NOT EXISTS public.sms_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  "count" integer DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  reported_to_stripe boolean DEFAULT false,
  reported_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_usage_subscription_id
  ON public.sms_usage(subscription_id);

ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_plans_updated_at ON public.plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_usage_updated_at ON public.sms_usage;
CREATE TRIGGER update_sms_usage_updated_at
  BEFORE UPDATE ON public.sms_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Functions
CREATE OR REPLACE FUNCTION public.get_current_sms_usage(p_subscription_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  usage_count integer;
BEGIN
  SELECT "count"
  INTO usage_count
  FROM public.sms_usage
  WHERE subscription_id = p_subscription_id
    AND period_start <= now()
    AND period_end >= now()
  ORDER BY period_start DESC
  LIMIT 1;

  RETURN COALESCE(usage_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_sms_usage(
  p_subscription_id uuid,
  p_count integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  usage_id uuid;
  usage_count integer;
  period_start timestamptz;
  period_end timestamptz;
BEGIN
  SELECT id, "count"
  INTO usage_id, usage_count
  FROM public.sms_usage
  WHERE subscription_id = p_subscription_id
    AND period_start <= now()
    AND period_end >= now()
  ORDER BY period_start DESC
  LIMIT 1;

  IF usage_id IS NULL THEN
    period_start := now();
    period_end := now() + interval '1 month';
    INSERT INTO public.sms_usage (subscription_id, "count", period_start, period_end)
    VALUES (p_subscription_id, COALESCE(p_count, 1), period_start, period_end)
    RETURNING "count" INTO usage_count;
  ELSE
    UPDATE public.sms_usage
    SET "count" = COALESCE("count", 0) + COALESCE(p_count, 1),
        updated_at = now()
    WHERE id = usage_id
    RETURNING "count" INTO usage_count;
  END IF;

  RETURN COALESCE(usage_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_trial_status(p_merchant_id uuid)
RETURNS TABLE (
  days_remaining integer,
  openings_filled integer,
  reason text,
  should_end boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trial_end_at timestamptz;
  openings_count integer;
  days_left integer;
  end_reason text;
  end_now boolean;
BEGIN
  SELECT trial_end, openings_filled_during_trial
  INTO trial_end_at, openings_count
  FROM public.subscriptions
  WHERE merchant_id = p_merchant_id;

  openings_count := COALESCE(openings_count, 0);

  IF trial_end_at IS NULL THEN
    days_left := 0;
  ELSE
    days_left := GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (trial_end_at - now())) / 86400.0)
    )::integer;
  END IF;

  IF trial_end_at IS NOT NULL AND trial_end_at <= now() THEN
    end_reason := 'time_expired';
    end_now := true;
  ELSIF openings_count >= 2 THEN
    end_reason := 'openings_filled';
    end_now := true;
  ELSE
    end_reason := NULL;
    end_now := false;
  END IF;

  RETURN QUERY
    SELECT days_left, openings_count, end_reason, end_now;
END;
$$;
