# Deployment Plan - Settings Hub + Staff/Locations Split

**Date:** 2026-02-03  
**Target:** https://www.openalert.org (Vercel)  
**Branch:** `main`  

## Scope of this release
- New Settings hub at `/merchant/settings`
- Business Settings moved to `/merchant/settings/business` (explicit save)
- Staff & Locations moved to `/merchant/settings/staff-locations` (autosave)
- Nav label updated to "Settings"
- Billing return URLs now point to `/merchant/billing`

## Assumptions to validate
- No Supabase edge functions changed (no deploy needed).
- No backend (`server/`) changes (Railway deploy not required).
- No database migrations required.
- New `history` dependency is present in `package.json` + `pnpm-lock.yaml`.

## Preflight checks (local)
1. **Working tree review**
   - Ensure only intended files are staged for release.
   - Do **not** include `.taskmaster/*` changes in the commit.
2. **Sanity checks**
   - Verify routes resolve: `/merchant/settings`, `/merchant/settings/business`, `/merchant/settings/staff-locations`.
   - Confirm billing links redirect to `/merchant/billing`.

## Test plan (local)
- `pnpm lint:changed`
- `pnpm typecheck`
- Optional if time allows: `pnpm test` (Playwright)

## Deployment steps
1. **Commit & push**
   - Stage only release files (exclude `.taskmaster/*`).
   - Commit with a descriptive message.
   - Push to `origin/main` (triggers CI + Vercel + Railway auto-deploy).
2. **Supabase edge functions**
   - If `supabase/functions` changes exist, deploy manually:
     - `supabase link --project-ref gawcuwlmvcveddqjjqxc`
     - `supabase functions deploy`

## Post-deploy verification (production)
1. Visit `/merchant/settings` and ensure hub renders with cards and metrics.
2. Verify Business Settings page save flow + unsaved-changes modal.
3. Verify Staff & Locations autosave behavior:
   - Add/edit/delete staff
   - Delete guard for last staff member per location
   - Set default location works and updates active location
4. Verify billing return URLs land on `/merchant/billing`.

## Edge cases to watch
- Deep links to the old settings page now hit the hub (expected).
- Autosave page should never show the unsaved-changes modal.
- Default location updates should immediately reflect in active location.

## Rollback plan
- Revert the release commit(s) on `main` and push.
- Vercel + Railway will auto-deploy the rollback.
- If edge functions were deployed, redeploy the previous version from Supabase.
