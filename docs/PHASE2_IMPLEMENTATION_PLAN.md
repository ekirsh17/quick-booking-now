# Phase 2 Detailed Implementation Plan (Multi-location MVP)

Scope: add multi-location support with a lightweight switcher, location-scoped data, and a single subscription that covers all locations. Keep UX minimal for single-location merchants.

---

## Goals

- Allow merchants to create and manage multiple locations (name, address, phone, time zone).
- Introduce a **location switcher** that scopes all location-sensitive pages.
- Make consumer notify flows and QR links location-specific.
- Keep billing simple: one subscription, seats as a shared pool across locations.
- Keep single-location UX unchanged.

## Non-goals (Phase 2)

- Roles/permissions or staff availability.
- Staff-level services or reporting.
- Location-level analytics rollups beyond scoped filtering.
- Per-location seat allocation UI.

---

## Confirmed decisions (2026-02-03)

- **Inbound email strategy:** per-location inbound email addresses (tokenized). Primary guidance: add the OpenAlert address as a notification recipient in the booking platform. Fallback: forward from the inbox that receives booking notifications if extra recipients are not supported.
- **Seat allocation UX:** shared seat pool across locations. No manual per-location allocation; optional per-location counts later.

---


## Engineering guardrails (apply to every sub-phase)

- Build clean, scalable code and keep changes minimally invasive.
- Avoid regressions: preserve single-location behavior unless explicitly changed.
- Think through edge cases and challenge assumptions before implementation.
- Prefer small, well-scoped PRs and validate each slice with a smoke check.
- Document any deviations or open questions in this plan before proceeding.

---

## Status tracker

- [x] 1a) Data model + migrations (per-location inbound email)
- [x] 1b) RPC + types for location inbound email
- [x] 1c) Inbound email pipeline migration
- [x] 1d) Location management UI (onboarding + settings)
- [x] 1e) Location switcher + active location persistence
- [x] 1f) Scope merchant pages to active location (includes QR per-location uniqueness fix)
- [ ] 1g) Consumer notify + QR routing
- [ ] 1h) Billing alignment (shared seat pool)
- [ ] 1i) Reporting scope
- [ ] 1j) Verification + rollout

---

## Implementation sequence (ordered)

### 1a) Data model + migrations (per-location inbound email)

- Ensure `locations` includes `name`, `address`, `phone`, `time_zone`.
- Add to `locations`:
  - `inbound_email_token` (uuid, unique)
  - `inbound_email_status` (text)
  - `inbound_email_verified_at` (timestamptz)
  - `inbound_email_last_received_at` (timestamptz)
- Backfill the default location with existing `profiles.inbound_email_*` values.
- Add unique index on `locations.inbound_email_token`.
- Keep `profiles.inbound_email_*` temporarily for backward compatibility.

### 1b) RPC + types for location inbound email

- Add `ensure_location_inbound_email(location_id uuid)` RPC that returns:
  - `inbound_email_token`, `inbound_email_address`, `inbound_email_status`, `inbound_email_verified_at`.
- Update typed Supabase definitions.
- Keep existing `ensure_inbound_email` only until UI and functions are migrated.

### 1c) Inbound email pipeline migration

- Update `supabase/functions/inbound-email/index.ts` to:
  - Look up location by `locations.inbound_email_token`.
  - Use `locations.merchant_id` for authorization + writes.
  - Store `email_inbound_events.location_id` for each event.
- Ensure auto-openings created from inbound email include `location_id`.

### 1d) Location management UI (onboarding + settings)

- Onboarding: allow creation of the default location; optional “Add location” flow.
- Settings: add Locations section for add/edit/delete.
- Prevent deleting a location with assigned staff/openings (mirror staff delete protection).

### 1e) Location switcher + active location persistence

- Add a switcher in `MerchantLayout` (only when `locations.length > 1`).
- Persist selection in local storage; fallback to `profiles.default_location_id`.
- Update `useActiveLocation` to read/write the selected location id.

### 1f) Scope merchant pages to active location

- **Openings:** `src/pages/merchant/Openings.tsx`, `src/hooks/useOpenings.tsx`.
- **Staff:** `src/hooks/useStaff.tsx`, settings roster UI.
- **QR codes:** `src/hooks/useQRCode.tsx`, `supabase/functions/generate-merchant-qr/index.ts`.
- Ensure one active QR per `(merchant_id, location_id)`; remove legacy `UNIQUE(merchant_id)` constraint.
- **Calendar integrations:** any location-scoped calendar account/event fetches.

### 1g) Consumer notify + QR routing

- Add location-specific route: `/notify/:merchantId/:locationId`.
- Keep `/notify/:merchantId` working; redirect to default location if multiple.
- QR codes should encode the location-specific notify URL.
- `QRRedirect` should navigate to `/notify/:merchantId/:locationId`.
- `ConsumerNotify` should load the location by `location_id` and persist `notify_requests.location_id`.
- DB: update notify request uniqueness to `(merchant_id, consumer_id, location_id)` and add `get_public_location` RPC.

### 1h) Billing alignment (shared seat pool)

- `subscriptions.seats_count` represents total seats across all locations.
- Stripe quantity equals total seats (sum of staff across locations).
- Staff creation gating uses total seats; optionally show per-location counts.

### 1i) Reporting scope

- Apply active location filter to any merchant reporting queries.
- Ensure switcher changes scope without mutating historical data.

### 1j) Verification + rollout

- Migrations first, then deploy edge functions, then ship frontend changes.
- Keep backward compatibility for single-location merchants throughout.

---

## Risks + mitigations

- **Risk:** Old notify URLs break if location required.
  - **Mitigation:** keep `/notify/:merchantId` and redirect to default location.
- **Risk:** Inbound email tokens collide or remain on profiles.
  - **Mitigation:** unique index on `locations.inbound_email_token` and migrate all reads/writes.
- **Risk:** Merchants with one location see new UI.
  - **Mitigation:** gate switcher + location UI behind `locations.length > 1` (except onboarding).

---

## Test / verification checklist

Manual checks:
- Onboarding creates default location and allows adding a second.
- Switcher appears only with >1 location and persists selection.
- Openings list and creation are scoped to active location.
- QR codes resolve to location-specific notify pages.
- Consumer notify requests store `location_id` and match only that location.
- Inbound email creates openings tied to the correct location.
- Stripe seats quantity matches total staff across locations.

Database checks:
- `notify_requests.location_id` is always set.
- `email_inbound_events.location_id` matches the location token used.
- `locations.inbound_email_token` exists for each location.
