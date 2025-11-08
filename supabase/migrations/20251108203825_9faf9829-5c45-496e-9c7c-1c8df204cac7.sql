-- Add working_hours column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
  "monday": {"start": "09:00", "end": "17:00", "enabled": true},
  "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
  "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
  "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
  "friday": {"start": "09:00", "end": "17:00", "enabled": true},
  "saturday": {"start": "10:00", "end": "14:00", "enabled": false},
  "sunday": {"start": "10:00", "end": "14:00", "enabled": false}
}'::jsonb;

COMMENT ON COLUMN profiles.working_hours IS 'Business hours configuration for calendar display';