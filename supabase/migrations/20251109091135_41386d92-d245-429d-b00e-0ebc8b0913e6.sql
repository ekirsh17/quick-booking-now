-- Add saved_durations column to profiles table
ALTER TABLE profiles 
ADD COLUMN saved_durations integer[] DEFAULT ARRAY[15, 30, 45, 60, 90, 120];