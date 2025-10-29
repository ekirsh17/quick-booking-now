-- Add use_booking_system toggle to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS use_booking_system BOOLEAN DEFAULT false;

-- Add consumer_phone to slots for SMS notifications
ALTER TABLE slots 
ADD COLUMN IF NOT EXISTS consumer_phone TEXT;

-- Add index for faster queries on pending_confirmation status
CREATE INDEX IF NOT EXISTS idx_slots_status_merchant ON slots(merchant_id, status);