-- Backfill email for the existing merchant account

update public.profiles
set email = 'evan@kirsh.org'
where (email is null or email = '')
  and (phone = '5165879844' or phone = '+15165879844' or phone like '%5165879844%');
