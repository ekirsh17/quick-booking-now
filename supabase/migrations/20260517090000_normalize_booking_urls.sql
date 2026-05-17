-- Backfill legacy profile booking URLs so links work without requiring users
-- to include an explicit protocol.
UPDATE public.profiles
SET booking_url = CASE
  WHEN booking_url IS NULL THEN NULL
  WHEN btrim(booking_url) = '' THEN NULL
  WHEN btrim(booking_url) ~* '^[a-z][a-z0-9+\.-]*:' THEN btrim(booking_url)
  ELSE 'https://' || btrim(booking_url)
END
WHERE booking_url IS NOT NULL;
