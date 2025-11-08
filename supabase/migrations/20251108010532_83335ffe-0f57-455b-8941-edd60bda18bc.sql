-- Allow public users to insert QR code scan records
CREATE POLICY "Anyone can track QR scans"
ON public.qr_code_scans
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public users to increment scan counts via RPC
-- (The RPC function is already SECURITY DEFINER so it runs with elevated privileges)