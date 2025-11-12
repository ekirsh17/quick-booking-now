-- Create duration_presets table (unified pattern with appointment_type_presets)
CREATE TABLE IF NOT EXISTS public.duration_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  duration_minutes integer NOT NULL,
  color_token text,
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, label),
  CHECK (duration_minutes > 0 AND duration_minutes <= 480)
);

-- RLS policies
ALTER TABLE public.duration_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage own duration presets"
  ON public.duration_presets
  FOR ALL
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

-- Trigger to limit presets per merchant
CREATE OR REPLACE FUNCTION check_duration_preset_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM duration_presets WHERE merchant_id = NEW.merchant_id) >= 20 THEN
    RAISE EXCEPTION 'Maximum 20 duration presets per merchant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER duration_preset_limit_check
  BEFORE INSERT ON public.duration_presets
  FOR EACH ROW
  EXECUTE FUNCTION check_duration_preset_limit();

-- Trigger to update updated_at
CREATE TRIGGER update_duration_presets_updated_at
  BEFORE UPDATE ON public.duration_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing saved_durations from profiles to duration_presets
DO $$
DECLARE
  profile_record RECORD;
  duration_value integer;
  preset_position integer;
BEGIN
  FOR profile_record IN 
    SELECT id, saved_durations 
    FROM public.profiles 
    WHERE saved_durations IS NOT NULL AND array_length(saved_durations, 1) > 0
  LOOP
    preset_position := 0;
    FOREACH duration_value IN ARRAY profile_record.saved_durations
    LOOP
      INSERT INTO public.duration_presets (merchant_id, label, duration_minutes, position)
      VALUES (
        profile_record.id,
        CASE 
          WHEN duration_value < 60 THEN duration_value || 'm'
          WHEN duration_value = 60 THEN '1h'
          WHEN duration_value % 60 = 0 THEN (duration_value / 60) || 'h'
          ELSE (duration_value / 60) || '.' || (duration_value % 60) || 'h'
        END,
        duration_value,
        preset_position
      )
      ON CONFLICT (merchant_id, label) DO NOTHING;
      preset_position := preset_position + 1;
    END LOOP;
  END LOOP;
END $$;

-- Add default durations for merchants without any presets
INSERT INTO public.duration_presets (merchant_id, label, duration_minutes, position)
SELECT 
  p.id,
  UNNEST(ARRAY['15m', '30m', '45m', '1h', '1.5h', '2h']) as label,
  UNNEST(ARRAY[15, 30, 45, 60, 90, 120]) as duration_minutes,
  UNNEST(ARRAY[0, 1, 2, 3, 4, 5]) as position
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.duration_presets dp WHERE dp.merchant_id = p.id
)
ON CONFLICT (merchant_id, label) DO NOTHING;