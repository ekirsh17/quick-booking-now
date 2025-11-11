-- Function to automatically delete notify_requests after a consumer books any slot with that merchant
CREATE OR REPLACE FUNCTION delete_notify_requests_after_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the slot status changed to 'booked' or 'pending_confirmation'
  IF (NEW.status = 'booked' OR NEW.status = 'pending_confirmation') 
     AND (OLD.status IS NULL OR (OLD.status != 'booked' AND OLD.status != 'pending_confirmation'))
     AND NEW.booked_by_consumer_id IS NOT NULL THEN
    
    -- Delete all notify_requests for this consumer-merchant pair
    DELETE FROM public.notify_requests
    WHERE consumer_id = NEW.booked_by_consumer_id
      AND merchant_id = NEW.merchant_id;
    
    -- Log the cleanup
    RAISE NOTICE 'Deleted notify_requests for consumer % with merchant %', 
      NEW.booked_by_consumer_id, NEW.merchant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on slots table
DROP TRIGGER IF EXISTS cleanup_notify_requests_on_booking ON public.slots;
CREATE TRIGGER cleanup_notify_requests_on_booking
  AFTER UPDATE ON public.slots
  FOR EACH ROW
  EXECUTE FUNCTION delete_notify_requests_after_booking();