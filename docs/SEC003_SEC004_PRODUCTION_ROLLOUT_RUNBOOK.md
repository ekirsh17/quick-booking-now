# SEC-003 + SEC-004 Production Rollout Runbook

This runbook assumes there is no staging database and production is the source of truth.

## Scope

- SEC-003: remove broad `profiles` reads and move public/cross-merchant lookups to constrained RPCs.
- SEC-004: require inbound-email provider auth with gradual `warn` -> `enforce` rollout.

## Owners and Change Window

- **DB migration owner**: applies/rolls back SQL migrations.
- **Edge function owner**: deploys `inbound-email` auth mode and code.
- **Webhook owner**: updates provider webhook auth settings.
- **Observer**: monitors logs/metrics and calls rollback if trigger thresholds are hit.

## Phase 0: Preflight (Read-Only)

Run these checks before enforcement:

```sql
-- Current profile read policies.
select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;
```

```sql
-- Baseline inbound volume (24h).
select count(*) as inbound_events_24h
from public.email_inbound_events
where created_at >= now() - interval '24 hours';
```

```sql
-- Baseline auto-openings volume (24h).
select count(*) as email_openings_24h
from public.slots
where created_via = 'email'
  and created_at >= now() - interval '24 hours';
```

```sql
-- Baseline notifications created by email-driven slots (24h).
select count(*) as notify_requests_on_email_slots_24h
from public.notify_requests nr
join public.slots s on s.id = nr.slot_id
where s.created_via = 'email'
  and nr.created_at >= now() - interval '24 hours';
```

Manual smoke checks before rollout:

1. Merchant login with phone OTP succeeds.
2. Public notify page (`/notify/:merchant/:location`) loads business/location info.
3. Handle redirect (`/:handle` and `/:handle/:locationSlug`) resolves.

## Phase 1: Additive Deploy

1. Deploy app + migrations introducing constrained RPCs and frontend caller switches.
2. Deploy `inbound-email` auth code with:
   - `INBOUND_WEBHOOK_AUTH_MODE=warn`
3. Set auth secrets in Supabase Edge Function secrets:
   - `INBOUND_WEBHOOK_BASIC_USERNAME`
   - `INBOUND_WEBHOOK_BASIC_PASSWORD`
   - optional: `INBOUND_WEBHOOK_SHARED_SECRET`
   - optional: `INBOUND_WEBHOOK_SHARED_SECRET_HEADER`
4. Configure provider webhook auth to match.

Validation checkpoint (minimum 15-30 min of live traffic):

- No sustained rise in `inbound-email` warning logs for auth failures from legitimate traffic.
- New inbound events continue to be written.
- New email-created openings continue to appear.

## Phase 2: Enforce

1. Set `INBOUND_WEBHOOK_AUTH_MODE=enforce`.
2. Apply/confirm SEC-003 policy tightening migration (drop broad profile read policies).
3. Re-run manual smoke checks:
   - merchant login,
   - public notify page,
   - handle links,
   - merchant settings forwarding address visibility.

## Phase 3: Post-Enforcement Soak

Monitor for at least one business cycle (recommended: 24h):

- inbound event throughput vs. preflight baseline,
- email-created openings throughput vs. baseline,
- downstream notify-consumers behavior for email-created slots,
- error rate from public notify/claim flows.

## Rollback Triggers

Rollback immediately if any of the following are observed:

- Legitimate inbound-email requests failing with 401/403 at material volume.
- Meaningful drop in email-created openings or downstream consumer notifications.
- Regression in merchant login or public notify/handle flows.

## Fast Rollback Steps

### 1) Restore inbound ingress quickly

Set:

```text
INBOUND_WEBHOOK_AUTH_MODE=warn
```

or, for emergency bypass only:

```text
INBOUND_WEBHOOK_AUTH_MODE=off
```

Then redeploy `inbound-email` if required by your deployment process.

### 2) SQL rollback (if SEC-003 caller regressions persist)

Apply an emergency rollback migration similar to:

```sql
-- Restore broad read behavior (temporary emergency rollback only).
drop policy if exists "Users can view own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Anyone can view profiles"
  on public.profiles
  for select
  to authenticated, anon
  using (true);

create policy "anon_read_profile_by_handle"
  on public.profiles
  for select
  to anon
  using (handle is not null);
```

Use this only as a short-term emergency bridge, then re-apply hardened policy once callers are fixed.

## Post-Rollback Actions

1. Capture incident window timestamps and affected flows.
2. Export relevant function logs.
3. Identify whether failure was:
   - provider webhook auth mismatch,
   - missing secrets,
   - uncovered frontend caller path.
4. Patch and re-run Phase 1 before retrying enforcement.
