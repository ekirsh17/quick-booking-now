-- Phase 2: Prevent duplicate notify_requests and clean up existing duplicates

-- First, delete duplicate notify_requests, keeping only the most recent for each merchant+consumer pair
DELETE FROM public.notify_requests nr1
WHERE EXISTS (
  SELECT 1 
  FROM public.notify_requests nr2
  WHERE nr2.merchant_id = nr1.merchant_id
    AND nr2.consumer_id = nr1.consumer_id
    AND nr2.created_at > nr1.created_at
);

-- Create unique index to prevent future duplicates at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_notify_requests_merchant_consumer 
ON public.notify_requests(merchant_id, consumer_id);

-- Add comment explaining the constraint
COMMENT ON INDEX public.idx_notify_requests_merchant_consumer IS 
'Ensures each consumer can only have one active notification request per merchant to prevent duplicate SMS';