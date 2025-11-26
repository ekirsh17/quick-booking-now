-- Ensure profiles table is readable for merchant login (before authentication)
-- This is critical for the login flow to check if a merchant exists

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow phone-based profile lookup for SMS" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile or by phone" ON public.profiles;
DROP POLICY IF EXISTS "Anon can view profiles by phone" ON public.profiles;

-- Create a permissive policy that allows both authenticated and anonymous users to read profiles
-- This is needed for:
-- 1. Merchant login (checks if profile exists before authentication)
-- 2. SMS intake (Twilio function needs to lookup merchants by phone)
-- 3. Consumer flows (checking merchant profiles)
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);




