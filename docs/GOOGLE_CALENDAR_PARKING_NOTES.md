# Google Calendar Parking Notes

Status: parked for current production phase.

## What Was Parked

- Runtime entrypoints for Google Calendar integration:
  - `supabase/functions/google-calendar-oauth-callback/index.ts`
  - `supabase/functions/google-calendar-oauth-init/index.ts`
  - `supabase/functions/sync-calendar-events/index.ts`
  - `supabase/functions/push-bookings-to-calendar/index.ts`
  - `supabase/functions/cleanup-calendar-events/index.ts`
- Real-time booking-to-calendar trigger in the client:
  - `src/hooks/useBookingSync.tsx`

All runtime paths are now gated by:
- `GOOGLE_CALENDAR_ENABLED=true`

Default behavior when unset/false:
- OAuth callback redirects to settings with `calendar_parked=true` (or returns parked JSON fallback).
- Calendar edge functions return `200` with `{ parked: true }` and do no token/event writes.
- Booking sync hook does not subscribe or invoke `push-bookings-to-calendar`.

## Why It Was Parked

- Calendar UI is not currently part of active merchant settings flow.
- OAuth callback accepted unsigned state and could be abused to link external tokens.
- Parking removes attack surface now while preserving implementation for a safer resume.

## What Still Exists (Preserved)

- Calendar account management hooks/components
- Google OAuth and sync implementation code paths
- Existing calendar tables and schema

## Resume Checklist (Before Re-Enable)

1. Implement signed, tamper-resistant OAuth state validation in callback.
2. Review callback authorization boundaries and merchant ownership checks.
3. Validate token encryption/decryption and storage paths.
4. Add end-to-end tests for:
   - OAuth init + callback success/error paths
   - booked slot push behavior
   - cleanup/disconnect behavior
5. Enable only after security review by setting `GOOGLE_CALENDAR_ENABLED=true`.
