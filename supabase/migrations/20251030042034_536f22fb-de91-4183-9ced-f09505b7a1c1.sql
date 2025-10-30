-- Allow anyone to view profiles (merchant business info is public)
-- This is needed so consumers can see merchant business information when claiming slots
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);