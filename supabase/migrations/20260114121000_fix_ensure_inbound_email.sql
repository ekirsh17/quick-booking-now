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

  select profiles.inbound_email_token,
         profiles.inbound_email_status,
         profiles.inbound_email_verified_at
    into token, status, verified_at
    from profiles
   where profiles.id = merchant_id;

  if token is null then
    update profiles
       set inbound_email_token = gen_random_uuid(),
           inbound_email_status = 'pending'
     where profiles.id = merchant_id
     returning profiles.inbound_email_token,
               profiles.inbound_email_status,
               profiles.inbound_email_verified_at
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
