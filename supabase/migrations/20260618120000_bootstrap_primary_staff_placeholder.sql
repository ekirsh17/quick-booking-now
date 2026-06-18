-- Use a fixed placeholder for auto-created primary staff during profile bootstrap.
-- Business name defaults (e.g. "My Business") must not flow into staff.name because
-- onboarding treats staff names as user input on the business profile step.

CREATE OR REPLACE FUNCTION public.create_default_location_for_profile()
RETURNS TRIGGER AS $$
DECLARE
  loc_id uuid;
  existing_staff_id uuid;
BEGIN
  IF NEW.default_location_id IS NOT NULL THEN
    loc_id := NEW.default_location_id;
  ELSE
    SELECT id INTO loc_id
    FROM public.locations
    WHERE merchant_id = NEW.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF loc_id IS NULL THEN
      INSERT INTO public.locations (merchant_id, name, address, phone, time_zone, min_staff_enforced_at)
      VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.business_name, ''), 'Default Location'),
        NEW.address,
        NEW.phone,
        COALESCE(NEW.time_zone, 'America/New_York'),
        now()
      )
      RETURNING id INTO loc_id;
    ELSE
      UPDATE public.locations
      SET min_staff_enforced_at = COALESCE(min_staff_enforced_at, now())
      WHERE id = loc_id;
    END IF;

    UPDATE public.profiles
    SET default_location_id = loc_id
    WHERE id = NEW.id;
  END IF;

  SELECT s.id INTO existing_staff_id
  FROM public.staff s
  WHERE s.merchant_id = NEW.id
    AND s.location_id = loc_id
    AND COALESCE(s.active, true) = true
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF existing_staff_id IS NULL THEN
    INSERT INTO public.staff (merchant_id, name, is_primary, active, location_id)
    VALUES (
      NEW.id,
      'Primary Staff',
      true,
      true,
      loc_id
    );
  END IF;

  UPDATE public.locations
  SET min_staff_enforced_at = COALESCE(min_staff_enforced_at, now())
  WHERE id = loc_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
