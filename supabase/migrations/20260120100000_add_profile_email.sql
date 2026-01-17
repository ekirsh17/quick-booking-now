-- Add optional email to merchant profiles

alter table public.profiles
  add column if not exists email text;
