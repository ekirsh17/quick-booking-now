-- SEC-005: prevent authenticated clients from mutating subscription billing fields.
-- Keep merchant read access for UI, but remove direct INSERT/UPDATE capability.

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can create own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Merchants can update own subscription" ON public.subscriptions;

DROP POLICY IF EXISTS "Merchants can view own subscription" ON public.subscriptions;
CREATE POLICY "Merchants can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = merchant_id);
