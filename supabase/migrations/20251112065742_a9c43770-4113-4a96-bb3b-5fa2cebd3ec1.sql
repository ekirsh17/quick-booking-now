-- Create oauth_transactions table for PKCE/state management
CREATE TABLE IF NOT EXISTS public.oauth_transactions (
  tx_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  code_verifier TEXT NOT NULL,
  origin TEXT NOT NULL,
  redirect_to TEXT NOT NULL DEFAULT '/merchant/settings',
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE public.oauth_transactions ENABLE ROW LEVEL SECURITY;

-- Only allow the owner to view their own tx status; no public inserts/updates/deletes
CREATE POLICY "Users can view their own oauth tx"
ON public.oauth_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_tx_user ON public.oauth_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tx_expires ON public.oauth_transactions (expires_at);
