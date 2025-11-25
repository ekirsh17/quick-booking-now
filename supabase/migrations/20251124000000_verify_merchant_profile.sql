-- Verify and update merchant profile for SMS intake
-- This ensures the profile has the correct phone number, timezone, and default duration

-- Check current profile
SELECT id, name, phone, time_zone, default_opening_duration 
FROM profiles 
WHERE id = '64c4378e-34dd-4abf-b90e-c0ab7f861f6d';

-- Update profile to ensure correct configuration
UPDATE profiles 
SET 
  phone = '+15165879844',
  time_zone = COALESCE(time_zone, 'America/New_York'),
  default_opening_duration = COALESCE(default_opening_duration, 30)
WHERE id = '64c4378e-34dd-4abf-b90e-c0ab7f861f6d';

-- Verify the update
SELECT id, name, phone, time_zone, default_opening_duration 
FROM profiles 
WHERE id = '64c4378e-34dd-4abf-b90e-c0ab7f861f6d';



