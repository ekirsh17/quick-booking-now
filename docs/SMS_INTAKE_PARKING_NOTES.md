# SMS Intake Parking Notes

Status: parked for current production phase.

## What Was Parked

- Runtime entrypoint for merchant inbound SMS opening creation:
  - `supabase/functions/parse-sms-opening/index.ts`
- The function now returns a parked response unless:
  - `SMS_INTAKE_ENABLED=true`
- In production, the function remains hard-disabled unless:
  - `SMS_INTAKE_ALLOW_PRODUCTION=true` (explicit override)
- `supabase/config.toml` sets `parse-sms-opening` to `verify_jwt=true` to keep it non-routable for public callers by default.
- Twilio inbound webhook should point to:
  - `https://gawcuwlmvcveddqjjqxc.supabase.co/functions/v1/handle-sms-reply`

## Why It Was Parked

- Feature is not required in this phase.
- Parking removes current attack surface while preserving implementation work for later.

## What Still Exists (Preserved)

- Existing parsing and clarification logic in `parse-sms-opening`
- Related helpers and flow code:
  - `supabase/functions/shared/twilioValidation.ts`
  - `supabase/functions/send-sms/index.ts`
  - `supabase/functions/handle-sms-reply/index.ts`
- `handle-sms-reply` remains live for consumer compliance commands only:
  - `STOP`
  - `START`
- Merchant action-by-text commands are disabled in `handle-sms-reply`.

## Resume Checklist (Before Re-Enable)

1. Ensure Twilio signature validation is enforced in `parse-sms-opening`.
2. Confirm `send-sms` authorization controls are still in place.
3. Validate `sms_logs` RLS remains restricted to service role access.
4. Verify Twilio inbound webhook points to the intended endpoint.
5. Run end-to-end tests for:
   - SMS parse
   - clarification loop
   - opening creation
   - undo behavior

## Archive Reference

- Local archive branch created: `archive/sms-intake-v1`
- Working security branch: `fix/sec-001-sec-006-park-sms-intake`
