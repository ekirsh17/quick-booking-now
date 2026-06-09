# BUG-006 Closeout Notes

Date: 2026-06-09

## Product Risk Addressed

BUG-006 focused on inbound SMS reply paths potentially confirming bookings without a verified booking-state update.

For this release phase, merchant action-by-text flows are intentionally disabled and inbound SMS is hardened to prevent operational mutations from merchant replies.

## Hardening Applied

1. Twilio inbound webhook for production number `+18448203482` is routed to:
   - `https://gawcuwlmvcveddqjjqxc.supabase.co/functions/v1/handle-sms-reply`
2. `handle-sms-reply` now supports only:
   - `STOP`
   - `START`
   - All other messages receive a neutral non-action response.
3. `parse-sms-opening` was further locked down:
   - production hard-disable guard in function code
   - `verify_jwt = true` in `supabase/config.toml` for `parse-sms-opening`

## Validation Matrix

### Infrastructure + endpoint checks

- Twilio number webhook target confirmed as `handle-sms-reply`.
- `parse-sms-opening` unauthenticated POST now returns:
  - `401 UNAUTHORIZED_NO_AUTH_HEADER`
- `handle-sms-reply` invalid signature POST returns:
  - `403 Invalid signature`

### App regression checks

- `pnpm run lint:changed` passed
- `pnpm typecheck` passed
- `pnpm build` passed
- `pnpm test:unit` passed

## Inbound SMS copy (production toll-free)

| Keyword | Expected user experience |
|---------|--------------------------|
| `STOP` | 1 message: carrier `NETWORK MSG` only (Twilio custom Opt-Out does not apply on toll-free) |
| `START` | 2 messages: carrier `NETWORK MSG` + OpenAlert opt-in (Twilio Advanced Opt-Out, once enabled) |
| `HELP` | 1 message: OpenAlert help text (Twilio Advanced Opt-Out) |
| Other | 1 message: commands disabled (app TwiML) |

## BUG-006 Conclusion

- Merchant SMS `confirm/approve` is not a live operational path after hardening.
- No direct runtime fix is required in `confirm-booking` for this bug in the current release mode.
- BUG-006 is closed for current scope as a disabled-path risk, with explicit inbound SMS hardening in place.
