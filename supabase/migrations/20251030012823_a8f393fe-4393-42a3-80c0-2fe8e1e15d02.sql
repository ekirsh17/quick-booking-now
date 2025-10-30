-- Create OTP codes table
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  attempts int DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX idx_otp_phone ON public.otp_codes(phone);
CREATE INDEX idx_otp_expires ON public.otp_codes(expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to insert OTP codes
CREATE POLICY "Anyone can request OTP codes"
  ON public.otp_codes
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow anyone to read OTP codes for verification
CREATE POLICY "Anyone can verify OTP codes"
  ON public.otp_codes
  FOR SELECT
  USING (true);

-- Cleanup function for expired OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now();
END;
$$;