-- Add booking_count column to consumers table
ALTER TABLE consumers 
ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_consumers_booking_count 
ON consumers(booking_count);

-- Create function to increment booking count
CREATE OR REPLACE FUNCTION increment_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'booked' AND (OLD.status IS NULL OR OLD.status != 'booked') THEN
    UPDATE consumers 
    SET booking_count = booking_count + 1
    WHERE id = NEW.booked_by_consumer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on slots table
DROP TRIGGER IF EXISTS update_booking_count_trigger ON slots;
CREATE TRIGGER update_booking_count_trigger
AFTER UPDATE ON slots
FOR EACH ROW
EXECUTE FUNCTION increment_booking_count();