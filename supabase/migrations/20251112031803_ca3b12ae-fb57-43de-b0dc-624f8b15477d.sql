-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enum for calendar providers
CREATE TYPE calendar_provider AS ENUM ('google', 'icloud');

-- Create enum for account status
CREATE TYPE calendar_account_status AS ENUM ('connected', 'revoked', 'error');

-- Create enum for sync status
CREATE TYPE calendar_event_status AS ENUM ('created', 'updated', 'deleted', 'error');

-- External calendar accounts table
CREATE TABLE public.external_calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  email TEXT NOT NULL,
  status calendar_account_status NOT NULL DEFAULT 'connected',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Encrypted credentials stored as JSONB
  -- Google: {refresh_token, expiry_date, token_scope}
  -- iCloud: {username, app_password, principal_url, calendar_home_url}
  encrypted_credentials BYTEA,
  meta JSONB DEFAULT '{}'::jsonb,
  UNIQUE(merchant_id, provider, email)
);

-- External calendar links table (which calendar to sync to)
CREATE TABLE public.external_calendar_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.external_calendar_accounts(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, calendar_id)
);

-- External calendar events table (tracking synced events)
CREATE TABLE public.external_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.external_calendar_accounts(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  external_event_key TEXT NOT NULL UNIQUE, -- Format: extEvt:<merchantId>:<slotId>
  status calendar_event_status NOT NULL DEFAULT 'created',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id, account_id)
);

-- Enable RLS
ALTER TABLE public.external_calendar_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_calendar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for external_calendar_accounts
CREATE POLICY "Merchants can manage own calendar accounts"
  ON public.external_calendar_accounts
  FOR ALL
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

-- RLS Policies for external_calendar_links
CREATE POLICY "Merchants can manage own calendar links"
  ON public.external_calendar_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.external_calendar_accounts
      WHERE id = external_calendar_links.account_id
      AND merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.external_calendar_accounts
      WHERE id = external_calendar_links.account_id
      AND merchant_id = auth.uid()
    )
  );

-- RLS Policies for external_calendar_events
CREATE POLICY "Merchants can view own calendar events"
  ON public.external_calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.external_calendar_accounts
      WHERE id = external_calendar_events.account_id
      AND merchant_id = auth.uid()
    )
  );

-- Service role can manage all calendar events (for sync jobs)
CREATE POLICY "Service role can manage calendar events"
  ON public.external_calendar_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_calendar_accounts_merchant ON public.external_calendar_accounts(merchant_id);
CREATE INDEX idx_calendar_links_account ON public.external_calendar_links(account_id);
CREATE INDEX idx_calendar_events_slot ON public.external_calendar_events(slot_id);
CREATE INDEX idx_calendar_events_account ON public.external_calendar_events(account_id);
CREATE INDEX idx_calendar_events_status ON public.external_calendar_events(status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_calendar_accounts_updated_at
  BEFORE UPDATE ON public.external_calendar_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_links_updated_at
  BEFORE UPDATE ON public.external_calendar_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.external_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to encrypt calendar credentials
CREATE OR REPLACE FUNCTION encrypt_calendar_credentials(credentials_json JSONB, encryption_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgp_sym_encrypt(credentials_json::text, encryption_key);
END;
$$;

-- Function to decrypt calendar credentials
CREATE OR REPLACE FUNCTION decrypt_calendar_credentials(encrypted_data BYTEA, encryption_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key)::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Constraint to ensure only one default calendar per account
CREATE UNIQUE INDEX idx_one_default_calendar_per_account
  ON public.external_calendar_links(account_id)
  WHERE is_default = true;