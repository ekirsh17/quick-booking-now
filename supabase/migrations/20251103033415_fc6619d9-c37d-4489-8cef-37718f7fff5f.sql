-- Drop unique constraints to allow multiple notification requests per merchant
-- This enables consumers to create multiple requests to the same business
-- with different time ranges or dates

ALTER TABLE notify_requests 
  DROP CONSTRAINT IF EXISTS notify_requests_merchant_id_consumer_id_key;

ALTER TABLE notify_requests 
  DROP CONSTRAINT IF EXISTS notify_requests_merchant_consumer_unique;