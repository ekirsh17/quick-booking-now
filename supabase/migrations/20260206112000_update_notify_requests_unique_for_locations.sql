-- Phase 2: allow notify requests per location

-- Ensure location_id is backfilled
UPDATE public.notify_requests nr
SET location_id = p.default_location_id
FROM public.profiles p
WHERE nr.merchant_id = p.id
  AND nr.location_id IS NULL;

-- Drop legacy uniqueness (merchant + consumer)
ALTER TABLE public.notify_requests
  DROP CONSTRAINT IF EXISTS notify_requests_merchant_consumer_unique;

DROP INDEX IF EXISTS idx_notify_requests_merchant_consumer;

-- Remove any duplicates per merchant/consumer/location (keep most recent)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY merchant_id, consumer_id, location_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.notify_requests
)
DELETE FROM public.notify_requests nr
USING ranked r
WHERE nr.id = r.id
  AND r.rn > 1;

-- Enforce uniqueness per merchant + consumer + location
CREATE UNIQUE INDEX IF NOT EXISTS idx_notify_requests_merchant_consumer_location
  ON public.notify_requests(merchant_id, consumer_id, location_id);
