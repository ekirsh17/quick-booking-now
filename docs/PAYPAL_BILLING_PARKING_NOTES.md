# PayPal Billing Parking Notes

Status: parked for current production phase.

## What Was Parked

- Server-side PayPal billing API routes at:
  - `server/src/index.ts` -> `/api/billing/paypal/*`
- Supabase Edge Function runtime entrypoint:
  - `supabase/functions/paypal-webhook/index.ts`

Both surfaces are now gated by:
- `PAYPAL_BILLING_ENABLED=true`

Default behavior when unset/false:
- Server routes return `503` with `{ parked: true }`
- `paypal-webhook` returns `200` with `{ received: true, parked: true }`

## Why It Was Parked

- Stripe is the active billing path in production.
- Legacy PayPal routes were unauthenticated and expanded attack surface.
- Parking keeps code available for future reintroduction while blocking runtime abuse now.

## What Still Exists (Preserved)

- Legacy PayPal server logic in `server/src/routes/paypal.ts`
- Legacy PayPal checkout UI component:
  - `src/components/billing/PayPalCheckoutButton.tsx`
- Related schema/event handling references already in billing tables/functions

## Resume Checklist (Before Re-Enable)

1. Add authentication + merchant ownership checks to every PayPal server route.
2. Require and enforce PayPal webhook signature verification in all environments.
3. Re-validate all billing event writes are idempotent and scoped to the correct merchant.
4. Add end-to-end tests for:
   - plan lookup
   - subscription confirmation
   - cancel/suspend/activate flows
   - webhook replay handling
5. Only then set `PAYPAL_BILLING_ENABLED=true` in the target environment.
