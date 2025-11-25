-- Fix RLS policy for SMS phone-based profile lookup
-- The current policy requires auth.uid() which is NULL for anonymous Twilio requests
-- This migration fixes the policy to allow anonymous phone-based lookups

-- Drop the restrictive policy that blocks anonymous lookups
DROP POLICY IF EXISTS "Allow phone-based profile lookup for SMS" ON public.profiles;

-- Ensure the "Anyone can view profiles" policy exists and is active
-- This policy allows anonymous reads which Twilio Function needs for phone lookups
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Create a more permissive SMS-specific policy as backup
-- This explicitly allows phone-based lookups for anonymous requests
CREATE POLICY "Allow phone-based profile lookup for SMS"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (
  -- Authenticated users can see their own profile
  (auth.uid() IS NOT NULL AND id = auth.uid()) OR
  -- Authenticated users can see profiles matching their phone
  (auth.uid() IS NOT NULL AND phone = (SELECT phone FROM auth.users WHERE id = auth.uid())) OR
  -- Anonymous requests can read any profile (needed for Twilio phone lookups)
  auth.uid() IS NULL
);

