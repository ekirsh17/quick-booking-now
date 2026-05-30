-- Persist pending scheduled seat downgrades for durable billing UI state.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_seat_count integer,
  ADD COLUMN IF NOT EXISTS pending_seat_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_seat_schedule_id text;

