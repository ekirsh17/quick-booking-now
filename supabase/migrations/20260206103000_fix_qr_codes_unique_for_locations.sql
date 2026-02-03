-- Phase 2: allow one active QR code per merchant/location

ALTER TABLE public.qr_codes
  DROP CONSTRAINT IF EXISTS qr_codes_merchant_id_key;

-- Deactivate duplicates so only one active QR code remains per merchant/location
WITH ranked AS (
  SELECT
    id,
    merchant_id,
    location_id,
    ROW_NUMBER() OVER (
      PARTITION BY merchant_id, location_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.qr_codes
  WHERE is_active = true
)
UPDATE public.qr_codes q
SET is_active = false
FROM ranked r
WHERE q.id = r.id
  AND r.rn > 1;

-- Enforce one active QR code per merchant/location
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_codes_active_merchant_location
  ON public.qr_codes(merchant_id, location_id)
  WHERE is_active = true;

-- Optimize lookup by merchant/location
CREATE INDEX IF NOT EXISTS idx_qr_codes_merchant_location
  ON public.qr_codes(merchant_id, location_id);
