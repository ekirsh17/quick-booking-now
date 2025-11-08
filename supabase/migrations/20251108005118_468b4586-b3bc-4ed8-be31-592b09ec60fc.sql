-- Phase 1: Create qr_codes table for persistent QR code storage
CREATE TABLE public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  short_code TEXT UNIQUE NOT NULL,
  image_url TEXT,
  scan_count INTEGER DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  customization JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id)
);

-- Enable RLS
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qr_codes
CREATE POLICY "Merchants can view own QR codes"
  ON public.qr_codes FOR SELECT
  USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can manage own QR codes"
  ON public.qr_codes FOR ALL
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Anyone can view active QR codes for scan tracking"
  ON public.qr_codes FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_qr_codes_updated_at
  BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 2: Create qr_code_scans table for analytics
CREATE TABLE public.qr_code_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  device_type TEXT
);

-- Enable RLS
ALTER TABLE public.qr_code_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policy for qr_code_scans
CREATE POLICY "Merchants can view own QR scans"
  ON public.qr_code_scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.qr_codes 
      WHERE qr_codes.id = qr_code_scans.qr_code_id 
      AND qr_codes.merchant_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_qr_code_scans_qr_code_id ON public.qr_code_scans(qr_code_id);
CREATE INDEX idx_qr_code_scans_scanned_at ON public.qr_code_scans(scanned_at DESC);

-- Phase 3: Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true);

-- Storage RLS policies
CREATE POLICY "Anyone can view QR codes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qr-codes');

CREATE POLICY "Merchants can upload own QR codes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'qr-codes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Merchants can update own QR codes"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'qr-codes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Phase 4: Create RPC function for atomic scan count increment
CREATE OR REPLACE FUNCTION public.increment_qr_scan_count(qr_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.qr_codes 
  SET scan_count = scan_count + 1,
      last_scanned_at = now()
  WHERE id = qr_id;
END;
$$;