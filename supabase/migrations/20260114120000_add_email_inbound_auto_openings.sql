-- Add auto-openings via email ingestion (additive)

create extension if not exists pgcrypto;

do $$
begin
  if exists (select 1 from pg_type where typname = 'slot_created_via') then
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'slot_created_via' and e.enumlabel = 'email'
    ) then
      alter type slot_created_via add value 'email';
    end if;
  end if;
end$$;

alter table profiles
  add column if not exists booking_system_provider text,
  add column if not exists auto_openings_enabled boolean default false,
  add column if not exists inbound_email_token uuid,
  add column if not exists inbound_email_status text default 'pending',
  add column if not exists inbound_email_verified_at timestamptz,
  add column if not exists inbound_email_last_received_at timestamptz;

create table if not exists email_inbound_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references profiles(id) on delete cascade,
  message_id text unique,
  from_address text,
  to_address text,
  subject text,
  provider text,
  event_type text,
  raw_text text,
  raw_html text,
  parsed_data jsonb,
  confidence numeric,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists email_opening_confirmations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references profiles(id) on delete cascade,
  message_id text,
  appointment_name text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending',
  expires_at timestamptz,
  confirmed_at timestamptz,
  denied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table email_inbound_events enable row level security;
alter table email_opening_confirmations enable row level security;

drop policy if exists "select_own_email_inbound_events" on email_inbound_events;
create policy "select_own_email_inbound_events" on email_inbound_events
  for select using (merchant_id = auth.uid());

drop policy if exists "select_own_email_opening_confirmations" on email_opening_confirmations;
create policy "select_own_email_opening_confirmations" on email_opening_confirmations
  for select using (merchant_id = auth.uid());

create or replace function ensure_inbound_email()
returns table (
  inbound_email_token uuid,
  inbound_email_address text,
  inbound_email_status text,
  inbound_email_verified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  merchant_id uuid := auth.uid();
  token uuid;
  status text;
  verified_at timestamptz;
begin
  if merchant_id is null then
    raise exception 'not authenticated';
  end if;

  select inbound_email_token, inbound_email_status, inbound_email_verified_at
    into token, status, verified_at
    from profiles where id = merchant_id;

  if token is null then
    update profiles
      set inbound_email_token = gen_random_uuid(),
          inbound_email_status = 'pending'
      where id = merchant_id
      returning inbound_email_token, inbound_email_status, inbound_email_verified_at
      into token, status, verified_at;
  end if;

  return query
    select token,
           format('notify+%s@inbound.openalert.org', token),
           status,
           verified_at;
end;
$$;

revoke all on function ensure_inbound_email() from public;
grant execute on function ensure_inbound_email() to authenticated;
