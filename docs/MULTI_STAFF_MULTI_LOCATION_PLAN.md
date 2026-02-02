# Multi-Staff + Multi-Location Plan (Phases 0-2)

This doc captures a lightweight, scalable plan for adding multi-staff and multi-location support without turning OpenAlert into a full booking platform. It includes a 1-page decision template, current codebase snapshot, and a milestone checklist for Phases 0-2.

---

## Phase context snapshot (updated 2026-02-01)

- **Phase 0 (foundation) completed**:
  - Added `locations` table + default location per merchant.
  - Added `location_id` columns across location-scoped tables and backfilled existing data.
  - Added `useActiveLocation` hook and ensured all new writes include `location_id`.
  - Updated edge functions and server writes to persist `location_id`.
- **Phase 1A (notify requests staff_id) completed**:
  - Added `notify_requests.staff_id` + index for staff-aware consumer requests.
- **Phase 1B (staff roster in settings) completed**:
  - Staff section in Account Settings with add/remove, uniqueness validation, and delete protection.
  - Seat gating + upgrade CTA shown at the staff limit.
- **In progress**:
  - Stripe quantity → `subscriptions.seats_count` alignment to ensure seat gating matches paid quantity.

---

## Decision Doc Template (1-page)

- **Decision title**
- **Owner**
- **Date**
- **Problem / goal**
- **Context (what exists today)**
- **Options considered (2-3)**
- **Decision**
- **Why this decision**
- **Risks / tradeoffs**
- **Rollout plan**
- **Success metrics**
- **Revisit triggers**

---

## Product constraints (from founder)

- OpenAlert is a lightweight notify layer (not a full booking platform).
- Avoid heavy UX or choice overload. Only add fields when necessary.
- Keep existing flows stable. No regressions outside required changes.
- Staff controls appear only when >1 staff.
- Location switcher appears only when >1 location.
- Seats are per location (but billing should stay simple).

---

## Industry patterns to borrow (lightweight)

- **Staff selection:** Allow consumers to choose a specific staff member or "Any" to keep friction low. Do not show staff selection entirely when not needed.
- **Multiple locations:** Treat locations as a first-class filter / switcher within merchant-facing pages. Allow customer-facing pages to pick a location when multiple exist. Ideally prefill location to whichever QR code scanned/url visited to minimize consumer friction. Consider having different consumer-facing pages per location that each map to a unique URL/QR code if it provides a better experience. Support shared brand info across locations when possible.
- **Account structure:** Multi-location is often implemented as distinct locations under one login, with a switcher to move between location-specific views of all relevant pages within the app. 

References (research sources):
- Setmore: booking with specific staff / "any team member" and the option to skip staff selection.
- Setmore: multiple locations and location selection for customers.
- Booksy: multiple locations modeled as separate addresses/accounts with ability to merge for one login; distinction between shared location vs multi-staffer.
- Vagaro: multi-location with shared info and location switching; multi-location customer site behavior.

Reference links:
- https://support.setmore.com/en/articles/6511982-any-team-member-option
- https://support.setmore.com/en/articles/490939-skip-team-members
- https://www.setmore.com/features/multiple-locations
- https://support.booksy.com/hc/en-us/articles/16538539391122-How-do-I-set-up-a-business-with-multiple-addresses
- https://support.booksy.com/hc/en-us/articles/20255861937682-What-s-the-difference-between-a-Shared-Location-and-a-multi-staffer-business
- https://support.vagaro.com/hc/en-us/articles/360025659193-Switch-to-Another-Vagaro-Location
- https://support.vagaro.com/hc/en-us/articles/7515489788187-Share-Information-Between-Multi-Location-Businesses
- https://support.vagaro.com/hc/en-us/articles/20733790620571-MySite-Create-a-Website-for-Multi-Location-Businesses

---

## Current codebase snapshot (E2E)

Core entities today:
- **profiles** (merchant account + business info, time_zone, inbound email token/config).
- **staff** table exists (placeholder); `staff_id` exists on `slots`.
- **slots** table stores openings and bookings.
- **notify_requests** stores consumer opt-ins (unique per merchant + consumer).
- **qr_codes** / **qr_code_scans** for merchant notify QR.

Key flows today (file touchpoints):
- **Onboarding + billing seats:** `src/pages/merchant/Onboarding.tsx`, `src/components/onboarding/*`, `src/hooks/useOnboarding.tsx`, `server/src/routes/billing.ts`, `supabase/functions/stripe-webhook/index.ts`.
- **Openings calendar + creation:** `src/pages/merchant/Openings.tsx`, `src/components/merchant/openings/*`, `src/hooks/useOpenings.tsx`.
- **Staff placeholder:** `src/hooks/useStaff.tsx`, `supabase/migrations/20251109064634_*_staff.sql`.
- **Consumer notify flow:** `src/pages/ConsumerNotify.tsx`, `supabase/functions/notify-consumers/index.ts`, `notify_requests` table.
- **Claim flow + cleanup:** `src/pages/ClaimBooking.tsx`, `supabase/functions/claim-slot/index.ts`, trigger `delete_notify_requests_after_booking`.
- **Inbound email parsing (auto openings):** `supabase/functions/inbound-email/index.ts` + provider parsers (booksy, setmore).
- **SMS openings:** `supabase/functions/parse-sms-opening/index.ts` (already supports staff name parsing).
- **QR + redirect:** `supabase/functions/generate-merchant-qr/index.ts`, `supabase/functions/qr-redirect/index.ts`, `src/hooks/useQRCode.tsx`.

Important constraints:
- `useStaff` currently returns only `primaryStaff`; openings default to that staff.
- Consumer notify page fetches business info from `profiles` by `merchant_id`.
- QR redirect uses `/notify/:merchant_id`.

---

## Shared direction (scalable, lightweight)

Target hierarchy (conceptual):
- **Account (org)** → **Location** → **Staff**

Implementation principle:
- Treat location as a scoped context for openings, QR codes/urls, notify requests, and inbound automation.
- Keep organization-level info in `profiles` and move location-specific fields to a new `locations` table.
- Avoid new UI unless the merchant has >1 staff / >1 location.

Suggested location fields (MVP):
- name, address, phone, time_zone
- booking_url (optional, if unique by location)
- working_hours (optional, if unique by location)
- inbound email token/config (if per-location)

---

## Phase 0: Foundation (location-aware data model, no new UX)

Goal: add a location model + data wiring while keeping the current UI behavior (single default location).

Milestone checklist:
- [ ] Add `locations` table and create **one default location** per existing merchant.
- [ ] Add `location_id` to core tables that are location-scoped:
  - `slots`, `staff`, `notify_requests`, `qr_codes`, `email_inbound_events`, `email_opening_confirmations`,
    `external_calendar_accounts`, `external_calendar_events`, `sms_intake_state`, `sms_logs`.
- [ ] Backfill existing data to the default location for the only test merchant.
- [ ] Update Supabase RLS policies to include `location_id` where relevant.
- [ ] Update server functions and data writes to always set `location_id` (default location for now).
- [ ] Introduce a lightweight **location context** in the app layer (default location, no UI switcher yet).
- [ ] Keep all existing routes and UI unchanged (no location switcher yet).

Definition of Done:
- All new records in location-scoped tables have a `location_id`.
- No regression in onboarding, openings, notify flow, QR, or auto-openings.

---

## Phase 1: Multi-staff MVP (single location)

Goal: make staff functional throughout the app without adding roles/permissions.

Milestone checklist:
- [ ] **Staff roster UI** (Account Settings):
  - Add staff up to paid seats; hard delete only.
  - Minimal fields: name (required).
- [ ] **Onboarding staff name**:
  - Require primary staff name entry before completing onboarding.
  - Seed/update primary staff record for the default location.
- [ ] **Openings flow**:
  - Staff select dropdown on create/edit opening (only if >1 staff).
  - Show staff name in calendar cards and booked opening modal.
  - Add staff filter to openings views (day/week/agenda).
- [ ] **Consumer notify flow**:
  - If >1 staff, show staff dropdown with "Any staff" option.
  - Store `staff_id` on `notify_requests` (null = any staff).
  - Update notify engine to match staff-specific vs any-staff requests.
- [ ] **Messaging**:
  - Include staff name in outbound SMS/email where a staff is specified.
- [ ] **Auto-openings parsing**:
  - Extend inbound email parsing to extract staff name when present.
  - Map staff name -> staff_id where possible; otherwise leave null.
- [ ] Ensure "claim" removes consumers from all notify lists (already via trigger).

Definition of Done:
- Merchants can add staff names (up to seats).
- Staff is selectable on openings, shown in calendars, and filterable.
- Consumers can select specific staff or "Any staff" (only when multiple staff exist).
- No impact for single-staff merchants (UI stays minimal).

---

## Phase 2: Multi-location MVP (switcher + billing)

Goal: support multiple locations under one account with minimal complexity.

Milestone checklist:
- [ ] **Onboarding + Settings**:
  - Add lightweight location(s) creation (name, address, phone, timezone).
  - Allow adding/editing locations in Account Settings post-onboarding.
- [ ] **Location switcher** (visible only when >1 location):
  - Applies globally to location-scoped pages (openings, QR, settings, reporting).
  - Default to last-selected location (per device if remembered in local storage).
- [ ] **Location-scoped data**:
  - Openings, QR codes/urls, notify requests, auto-openings, and calendars are tied to selected location.
  - Consumer notify/QR links are location-specific.
- [ ] **Billing alignment**:
  - Seats are allocated per location.
  - Stripe seats quantity = sum across locations.
  - (Optional later) show per-location seat breakdown in UI.
- [ ] **Reporting**:
  - Respect location switcher (location-scoped metrics).

Definition of Done:
- Multi-location merchants can switch locations and manage openings/QR/notifications per location.
- Billing remains a single subscription with summed seats.
- Single-location merchants see no UI change.

---

## Guardrails / Non-goals (Phases 0-2)

- No roles/permissions yet.
- No staff availability scheduling.
- No staff-specific services or staff-level reporting.
- No staff-specific QR codes.
- No multi-location access control.

---

## Open decisions to confirm later

- **Inbound email strategy:** single inbox vs per-location inbox (default to single unless parsing becomes unreliable).
- **Location account settings inheritance:** which fields should be shared across locations vs location-specific by default.
- **Seat allocation UX:** how to keep per-location seats simple without adding extra steps.

---

## Notes for Phase 3+ (future)

- Roles + permissions (owner/manager/staff).
- Staff availability & time-off.
- Staff-level reporting.
- Location-level analytics rollups + org-level dashboards.
- Staff-specific services and durations.
