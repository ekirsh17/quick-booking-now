# Phase 0 Detailed Implementation Plan (Location Foundation)

Scope: build a location-aware data model and wiring **without** introducing any new UI. All existing flows must behave exactly as they do today for single-location merchants.

---

## Goals

- Add a `locations` table and wire `location_id` into location-scoped data.
- Default every merchant to a single location (no UI switcher yet).
- Ensure **all new writes** include `location_id` (default location for now).
- Keep inbound email behavior and user-facing configuration unchanged.

## Non-goals (Phase 0)

- No multi-location UI or switcher.
- No inbound email workflow changes (only add `location_id` in the background).
- No changes to billing or seat allocation UX.
- No staff UI changes (Phase 1).

---

## Confirmed Decisions

- Location time zone **inherits** from org unless explicitly overridden later.
- Inbound email remains **single inbox per account** in Phase 0.
- Staff roster fields are **name only** in v1.

---

## Data model changes

### New table: `locations`

Minimum fields:
- `id` (uuid, pk)
- `merchant_id` (uuid, fk -> profiles.id)
- `name` (text)
- `address` (text)
- `phone` (text)
- `time_zone` (text, inherits from profile)
- `created_at`, `updated_at`

Optional future fields (do not use yet):
- `booking_url`, `working_hours`
- inbound email token/config if we ever go per-location

### Add to `profiles`

- `default_location_id` (uuid, fk -> locations.id)
  - Used to avoid repeated lookups and to set `location_id` on inserts.

### Add `location_id` to location-scoped tables

Add nullable `location_id` first, then backfill, then optionally enforce NOT NULL.

Tables:
- `slots`
- `staff`
- `notify_requests`
- `qr_codes`
- `email_inbound_events`
- `email_opening_confirmations`
- `external_calendar_accounts`
- `external_calendar_events`
- `sms_intake_state`
- `sms_logs`

Indexing:
- `locations(merchant_id)`
- `{table}(location_id)` on each new column

---

## Migration plan (Supabase)

1) **Create locations table**
   - Add RLS policy: `auth.uid() = merchant_id`

2) **Add profiles.default_location_id**
   - Nullable for now (until backfill completes).

3) **Create default location for each merchant**
   - Insert 1 location per profile:
     - `name = profiles.business_name`
     - `address = profiles.address`
     - `phone = profiles.phone`
     - `time_zone = profiles.time_zone`
   - Set `profiles.default_location_id` to new location.

4) **Add location_id columns (nullable) + indexes**

5) **Backfill location_id**
   - Update each table to set `location_id = profiles.default_location_id` where `merchant_id = profiles.id`.
   - For tables that don’t include `merchant_id` (if any), use their related foreign key (e.g., calendar events via account).

6) **Optional: add NOT NULL**
   - Only after backfill success + code changes are deployed.

7) **RLS updates**
   - Keep current merchant-based policies.
   - Add `location_id` constraints only if they are simple and won’t break current access.

---

## App-level wiring (no new UI)

### Frontend (React)

Add a tiny “location context” layer that defaults to `profiles.default_location_id`.
No UI switcher yet.

Suggested approach:
- Add a hook (e.g., `useActiveLocation`) that loads `profiles.default_location_id`.
- Store in memory only (no UI); use for writes.

Places to include `location_id` on insert:
- **Openings**: `src/hooks/useOpenings.tsx` (createOpening)
- **Notify requests**: `src/pages/ConsumerNotify.tsx`
- **QR code generation**: `src/hooks/useQRCode.tsx` / edge function
- **Staff**: when Phase 1 writes begin

Places to include `default_location_id` in profile fetches:
- `useMerchantProfile`
- `ConsumerNotify` (business lookup)
- any other `profiles` fetch used for inserts

### Edge Functions / Server writes

Edge functions that insert or update location-scoped rows must include `location_id` (using `profiles.default_location_id`):

- `supabase/functions/parse-sms-opening/index.ts` (slot creation)
- `supabase/functions/inbound-email/index.ts` (email events + slot creation)
- `supabase/functions/handle-sms-reply/index.ts` (opening creation from confirmation)
- `supabase/functions/generate-merchant-qr/index.ts` (qr_codes insert)
- `supabase/functions/google-calendar-oauth-callback/index.ts` (calendar account insert)
- `supabase/functions/sync-calendar-events/index.ts` (external calendar events insert)
- `supabase/functions/push-bookings-to-calendar/index.ts` (calendar events insert/update)
- `supabase/functions/cleanup-calendar-events/index.ts` (event cleanup; ensure location stays consistent)

Backend server (`server/src/routes/*`) does not need changes in Phase 0.

---

## Backfill strategy (current test merchant only)

- Run the migrations normally.
- Backfill `location_id` for existing rows using `profiles.default_location_id`.
- For now, only the test merchant exists, so we can validate manually as a spot-check.

---

## Risks + mitigations

- **Risk:** new `location_id` columns remain null for some inserts.
  - **Mitigation:** update all insert paths in app + edge functions before enforcing NOT NULL.

- **Risk:** notify cleanup deletes across all locations once multi-location ships.
  - **Mitigation:** keep existing trigger in Phase 0; revisit in Phase 2 to include `location_id` if needed.

- **Risk:** inbound email pipeline breaks.
  - **Mitigation:** keep logic identical; only add `location_id` assignment.

---

## Test / verification checklist

Manual smoke tests (no UI changes expected):
- Onboarding completes and creates subscription with same seat logic.
- Create opening from merchant UI (calendar) and verify it appears.
- Consumer notify flow still works (QR and direct link).
- Claim booking flow still works; notify request cleanup still fires.
- Inbound email cancellation creates opening (if configured).
- SMS opening creation still works.
- QR code generation still works.

Database verification:
- New rows in `slots`, `notify_requests`, `qr_codes`, `email_inbound_events` have `location_id`.
- `profiles.default_location_id` is set for the test merchant.

---

## Notes for Phase 2 (not implemented now)

- Location switcher UI + location-specific links/QRs
- Optionally move inbound email tokens to `locations`
- Update notify cleanup trigger to scope by `location_id` (if desired)
