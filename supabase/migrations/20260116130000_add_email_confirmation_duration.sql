-- Add duration tracking for email opening confirmations

alter table email_opening_confirmations
  add column if not exists duration_minutes integer,
  add column if not exists duration_source text;
