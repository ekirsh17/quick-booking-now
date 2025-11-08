-- Add default opening duration to profiles table
ALTER TABLE profiles 
ADD COLUMN default_opening_duration INTEGER DEFAULT 30;

COMMENT ON COLUMN profiles.default_opening_duration IS 'Default duration in minutes for new openings created via calendar (15-120 minutes)';