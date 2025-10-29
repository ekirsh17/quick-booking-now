-- Create profiles table for merchants
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  booking_url TEXT,
  avg_appointment_value DECIMAL(10, 2) DEFAULT 70.00,
  require_confirmation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create consumers table
CREATE TABLE public.consumers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  saved_info BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consumers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create consumer"
  ON public.consumers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Consumers can view own data"
  ON public.consumers FOR SELECT
  USING (true);

-- Create slots table
CREATE TABLE public.slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'notified', 'held', 'booked', 'expired')),
  booked_by_consumer_id UUID REFERENCES public.consumers(id),
  booked_by_name TEXT,
  held_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage own slots"
  ON public.slots FOR ALL
  USING (auth.uid() = merchant_id);

CREATE POLICY "Anyone can view available slots"
  ON public.slots FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update slot status"
  ON public.slots FOR UPDATE
  USING (true);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES public.consumers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed'))
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = merchant_id);

-- Create notify_requests table for consumer opt-ins
CREATE TABLE public.notify_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES public.consumers(id) ON DELETE CASCADE,
  time_range TEXT NOT NULL DEFAULT 'today',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, consumer_id)
);

ALTER TABLE public.notify_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create notify request"
  ON public.notify_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Merchants can view own requests"
  ON public.notify_requests FOR SELECT
  USING (auth.uid() = merchant_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slots_updated_at
  BEFORE UPDATE ON public.slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name, phone, address)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'address', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();