-- Add saved appointment names column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN saved_appointment_names text[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.saved_appointment_names IS 'Array of saved appointment name templates for quick reuse';