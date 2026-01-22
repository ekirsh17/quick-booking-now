ALTER TABLE public.sms_logs
ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_merchant_id ON public.sms_logs(merchant_id);
