-- Create appointment_type_presets table for better preset management
CREATE TABLE IF NOT EXISTS public.appointment_type_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  color_token TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, label)
);

-- Enable RLS
ALTER TABLE public.appointment_type_presets ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own presets
CREATE POLICY "Merchants can manage own appointment presets"
ON public.appointment_type_presets
FOR ALL
USING (auth.uid() = merchant_id)
WITH CHECK (auth.uid() = merchant_id);

-- Create index for faster queries
CREATE INDEX idx_appointment_presets_merchant_position 
ON public.appointment_type_presets(merchant_id, position);

-- Add constraint to limit presets per merchant
CREATE OR REPLACE FUNCTION check_preset_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM appointment_type_presets WHERE merchant_id = NEW.merchant_id) >= 20 THEN
    RAISE EXCEPTION 'Maximum 20 appointment type presets per merchant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_preset_limit_trigger
BEFORE INSERT ON appointment_type_presets
FOR EACH ROW
EXECUTE FUNCTION check_preset_limit();

-- Trigger to update updated_at
CREATE TRIGGER update_appointment_presets_updated_at
BEFORE UPDATE ON public.appointment_type_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing saved_appointment_names to presets
DO $$
DECLARE
  profile_record RECORD;
  name TEXT;
  pos INTEGER;
BEGIN
  FOR profile_record IN 
    SELECT id, saved_appointment_names 
    FROM profiles 
    WHERE saved_appointment_names IS NOT NULL 
    AND array_length(saved_appointment_names, 1) > 0
  LOOP
    pos := 0;
    FOREACH name IN ARRAY profile_record.saved_appointment_names
    LOOP
      INSERT INTO appointment_type_presets (merchant_id, label, position, is_default)
      VALUES (profile_record.id, name, pos, false)
      ON CONFLICT (merchant_id, label) DO NOTHING;
      pos := pos + 1;
    END LOOP;
  END LOOP;
END $$;