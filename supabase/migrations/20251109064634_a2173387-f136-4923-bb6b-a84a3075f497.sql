-- Create staff table (placeholder for multi-staff support)
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  color text DEFAULT '#3B82F6',
  is_primary boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add staff_id to slots table
ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_slots_staff_id ON public.slots(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_merchant_id ON public.staff(merchant_id);

-- Enable RLS on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS policy: Merchants can manage own staff
CREATE POLICY "Merchants can manage own staff"
ON public.staff FOR ALL
TO authenticated
USING (auth.uid() = merchant_id)
WITH CHECK (auth.uid() = merchant_id);

-- Auto-create primary staff member for existing merchants
INSERT INTO public.staff (merchant_id, name, is_primary, active)
SELECT id, business_name, true, true
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff WHERE merchant_id = profiles.id AND is_primary = true
)
ON CONFLICT DO NOTHING;

-- Function to check for slot conflicts
CREATE OR REPLACE FUNCTION public.check_slot_conflict(
  p_merchant_id uuid,
  p_staff_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_slot_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.slots
    WHERE merchant_id = p_merchant_id
      AND (staff_id = p_staff_id OR (staff_id IS NULL AND p_staff_id IS NULL))
      AND id != COALESCE(p_slot_id, gen_random_uuid())
      AND (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      AND status != 'cancelled'
  );
END;
$$;