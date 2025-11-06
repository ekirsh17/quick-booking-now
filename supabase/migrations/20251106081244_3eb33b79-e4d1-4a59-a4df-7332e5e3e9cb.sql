-- Create SMS logs table for tracking all SMS activity
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text UNIQUE NOT NULL,
  to_number text NOT NULL,
  from_number text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  error_message text,
  direction text NOT NULL DEFAULT 'outbound', -- 'outbound' or 'inbound'
  sent_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_message_sid ON public.sms_logs(message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_logs_to_number ON public.sms_logs(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON public.sms_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_direction ON public.sms_logs(direction);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Service role can manage all logs
CREATE POLICY "Service role can manage SMS logs"
  ON public.sms_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_sms_logs_updated_at
  BEFORE UPDATE ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();