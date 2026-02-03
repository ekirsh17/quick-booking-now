# Settings IA Restructure Plan (Staff & Locations split)

## Decisions Confirmed
- Top-level nav label is **Settings**.
- Routes:
  - `/merchant/settings` → Settings hub
  - `/merchant/settings/business` → Business Settings (explicit save)
  - `/merchant/settings/staff-locations` → Staff & Locations (autosave)
- Staff & Locations page includes the subtle helper text: “Changes save automatically.”
- Default location control will be a **“Set as default”** action per location.

---

## Goals
- Keep **top‑level nav at 4 items**: Openings / Reporting / QR Code / **Settings**.
- Make saving behavior consistent **per page**:
  - Business Settings: explicit Save.
  - Staff & Locations: autosave only.
- Keep Staff & Locations **high‑visibility** because it drives revenue (seats).
- Avoid regressions and keep changes minimal‑risk (no data loss or destructive migrations).

---

## Information Architecture

### Top-level nav (unchanged)
- Openings
- Reporting
- QR Code
- Settings

### Settings hub
**Route:** `/merchant/settings`

**Layout:** card-based hub similar to the manage subscription UI.

**Primary cards (ordered by importance):**
1) **Business Settings**
   - Description: business identity, booking rules, working hours, integrations.
   - CTA: “Manage Business Settings” → `/merchant/settings/business`
2) **Staff & Locations**
   - Description: manage team, locations, and seats.
   - CTA: “Manage Staff & Locations” → `/merchant/settings/staff-locations`
   - Show metrics: `Seats used / total`, `Locations count`
3) **Billing**
   - CTA: “Manage Subscription” → `/merchant/billing`

> Rationale: keeps Staff & Locations discoverable without adding a top‑level nav item.

### Business Settings page
**Route:** `/merchant/settings/business`

**Save model:** explicit Save button (existing behavior). Unsaved‑changes modal only here.

**Sections (grouped):**
- **Business Profile**: name, email, phone, address, time zone, business type
- **Booking Rules**: booking system toggle/provider, booking URL, require confirmation, auto‑openings
- **Working Hours**
- **Appointment Defaults**: default opening duration, avg appointment value
- **Integrations**: Calendar sync, inbound email status/verification (tied to booking system)

> All fields on this page save via the floating Save button.

### Staff & Locations page
**Route:** `/merchant/settings/staff-locations`

**Save model:** autosave only (no Save button). All changes persist immediately.

**Sections:**
- Locations
- Staff
- Seat usage summary (read‑only) + CTA to Billing

**Default location control:**
- Each location row has a **“Set as default”** action.
- When clicked, update `profiles.default_location_id` and reflect the UI state.

**Rule enforcement:**
- Cannot delete the last staff member in a location. Toast: “Each location needs at least one staff member. You can edit their name instead.”
- Cannot delete a location with staff/openings assigned (existing guard).

---

## Seat Purchasing Strategy
- **Purchasing remains in Billing** (single source of truth).
- Staff & Locations displays seat usage + a clear CTA to Billing.

---

## Save Behavior (Consistency)
- **Business Settings:** explicit Save only.
- **Staff & Locations:** autosave only.

**Autosave helper text:** “Changes save automatically.” (subtle, top of page).

---

## Backend / Migrations
- **No migrations required.**
- Backend write needed only for default location updates: `profiles.default_location_id`.

---

## Phased Implementation Plan (Ordered)

### 1a) Navigation + routing foundation
- Update left nav label from Account → **Settings**.
- Add routes:
  - `/merchant/settings` → Settings hub
  - `/merchant/settings/business` → Business Settings
  - `/merchant/settings/staff-locations` → Staff & Locations
- Ensure any existing direct links to `/merchant/settings` still work (now hub).

### 1b) Settings hub page
- Create `AccountHub` page with three cards (Business Settings, Staff & Locations, Billing).
- Populate metrics:
  - `seatUsage` from `useSubscription()`
  - locations count from `locations` query
- Ensure cards match existing UI style (Card + Button).

### 1c) Business Settings page extraction
- Split the current Settings page into a new `BusinessSettingsPage`.
- Keep `handleSave` and floating Save button here only.
- Add unsaved‑changes modal (navigation + refresh) scoped to this page only.
- Ensure all existing profile validations remain intact.

### 1d) Staff & Locations page extraction
- Move all staff and locations sections into `StaffLocationsPage`.
- Remove Save button entirely; add autosave helper text.
- Enforce last‑staff delete block **per location** with guidance to rename instead.
- Keep delete guards for locations with staff/openings.
- If an active location is deleted (allowed only if empty), fall back to default location.

### 1e) Default location management
- Add “Set as default” action per location.
- Update `profiles.default_location_id` when chosen and refresh the locations list.
- Ensure `useActiveLocation` falls back to the new default after change.

### 1f) Link + copy consistency pass
- Update in‑app links/buttons to the new routes.
- Ensure copy uses “Settings” (nav + headers) and “Staff & Locations” (page + card).
- Keep “Business Settings” naming consistent across hub and page H1.

### 1g) QA + rollout
- Validate behavior on the single test merchant.
- Confirm no data loss or regressions on existing flows.

---

## Edge Cases + Assumption Checks
- **Mixed save models** are now separated by page to avoid user confusion.
- **Deep links** to `/merchant/settings` now land on the hub; this is expected.
- **Active location deleted**: ensure `useActiveLocation` falls back to default if the current location is removed.
- **Default location changed**: update `profiles.default_location_id` and propagate to any UI that references it.
- **Seat usage** should update after staff add/delete (autosave) without a hard refresh.
- **Unsaved changes modal** should never trigger on the autosave page.
- **Booking system + inbound email** remain under Business Settings to avoid splitting feature logic.

---

## Testing Checklist

**Settings hub**
- Cards render, metrics load, CTAs navigate correctly.

**Business Settings**
- Unsaved‑changes modal triggers on nav / refresh.
- Save persists all fields and validations remain unchanged.

**Staff & Locations**
- Add/edit/delete staff autosaves.
- Deleting last staff blocked with clear message.
- Location delete guards still enforced.
- Seats summary updates after staff changes.
- Default location can be changed and reflects in UI.

---

## Notes
- No migrations expected.
- This plan is optimized for minimal regression risk while clarifying save behavior.
