# Subscription UI states (banner + pill)

This document defines how we surface Stripe subscription health in the merchant app. **One shared model** drives both the **layout banner** (`PaymentRequiredBanner` in `MerchantLayout`) and the **Manage Subscription** header pill so they never disagree.

## Principles

1. **Single source of truth** — `computeSubscriptionUiState` in `src/lib/subscriptionUiState.ts` maps `useSubscription()` outputs + the Supabase `subscriptions` row to a small set of UI kinds. Banner and pill both consume this result (`useSubscriptionUiState`).
2. **Pill and banner match** — Same label and severity (green vs amber vs red) for every state **except** healthy paid and healthy trial, where **no banner** is shown (pill only).
3. **Stripe sync** — Returning from Stripe (checkout or portal) already triggers `POST /api/billing/reconcile-subscription` + refetch on the Billing page. Opening **Manage Subscription** runs reconcile again (`force`) so DB mirrors Stripe even if webhooks lag. `useSubscription` also refreshes on tab focus / visibility / interval when data is stale.
4. **Billing-agnostic** — Seat count and monthly vs annual only affect invoices and seat APIs; they do **not** branch this UI state machine.

## States

| Kind | Pill text | Color | Banner |
|------|-----------|-------|--------|
| `trial_active` | Trial Active | Green | None |
| `trial_expiring` | Trial Expiring | Amber | Yes — trial still running but billing will not convert (missing/default payment removed, must resubscribe/reactivate in Stripe, etc.). Includes an **end date** when known (`trial_end`). |
| `active` | Active | Green | None |
| `expiring` | Expiring | Amber | Yes — paid period still active but access after this period is at risk: **past due**, **paused**, **cancel at period end** (renewal stopped), or default payment invalid for the next charge. Uses **`current_period_end`** (or effective cancel date) when known. |
| `expired` | Expired | Red | Yes — subscription/trial access has ended; user must subscribe again. |

### Why “Expiring” covers multiple Stripe situations

Stripe separates **payment failure** (`past_due`), **pause**, and **cancel_at_period_end**. Product-wise they are all “still active for now, but won’t renew or will lapse unless the customer fixes billing.” We keep **one** amber state so messaging stays consistent with research CTAs (manage billing / add payment / reactivate).

### Relationship to feature gates

`useEntitlements` continues to compute **canCreateOpenings**, **blockReason**, etc. This doc covers **display only**. Gates stay backward-compatible; we did not move RLS or server checks into the UI helper.

## Files

- `src/lib/subscriptionUiState.ts` — pure `computeSubscriptionUiState`
- `src/hooks/useSubscriptionUiState.ts` — wraps `useSubscription` + formatting helpers
- `src/components/merchant/MerchantLayout.tsx` — banner
- `src/pages/merchant/Billing.tsx` — pill + reconcile-on-mount

## Stripe / DB mapping notes

- **`past_due`** and **`paused`** map to **Expiring** (amber): payment or subscription schedule needs attention before renewal.
- **`cancel_at_period_end`** on an otherwise active paid subscription maps to **Expiring** with **scheduled_cancel** copy (same pill/banner as other expiring cases).
- Legacy distinct pills such as “Past Due”, “Paused”, “Cancelling” as separate green/blue states were removed in favor of the five states above.

## Sync behavior

- **Manage Subscription** (`Billing.tsx`): on mount, calls `POST /api/billing/reconcile-subscription` with **force** (respecting server sync), then refetches Supabase subscription + `notifySubscriptionRefresh()`.
- **Stripe return URLs** (`?billing=success` / `portal_return`): existing flows still reconcile + refetch + broadcast.
- **`useSubscription`**: continues to refresh on window focus, visibility, and on a stale interval; unchanged.
