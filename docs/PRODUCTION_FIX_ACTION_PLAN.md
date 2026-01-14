# Production Database Fix - Action Plan

**Status**: Root cause identified and fixes created. Ready for deployment.

## 🔴 Root Cause

The `handle_new_user` trigger function was only reading phone from `raw_user_meta_data->>'phone'`, but `verify-otp` sets phone in `auth.users.phone`. This caused profiles to be created with **empty phone strings**, making SMS parsing fail.

## ✅ What AI Has Completed

1. ✅ **Identified root cause** - `handle_new_user` function bug
2. ✅ **Created fix migration** - `20250127000000_fix_handle_new_user_phone_extraction.sql`
3. ✅ **Created data fix migration** - `20250127000001_fix_existing_profiles_empty_phone.sql`
4. ✅ **Updated `supabase/config.toml`** - Changed to production project ID
5. ✅ **Updated 13 documentation files** - All now reference production project
6. ✅ **Created assessment reports** - Full documentation of findings

## 👤 What You Need To Do

### Step 1: Link CLI to Production
```bash
supabase link --project-ref gawcuwlmvcveddqjjqxc
```

### Step 2: Push Migrations
```bash
supabase db push
```
This will:
- Apply the two new fix migrations
- Fix the `handle_new_user` function
- Fix existing profiles with empty phone numbers
- Ensure all other migrations are applied

### Step 3: Deploy Edge Functions
```bash
supabase functions deploy
```

### Step 4: Configure Edge Function Secrets
Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets

Add these secrets (use values from your production project):
- `SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (your production service role key)
- `SUPABASE_ANON_KEY` = (your production anon key)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
- All other secrets from `docs/EDGE_FUNCTIONS_SETUP.md`

### Step 5: Update Deployment Environment Variables

**Frontend (Vercel/Netlify/etc.)**:
- `VITE_SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (production anon key)
- `VITE_SUPABASE_PROJECT_ID` = `gawcuwlmvcveddqjjqxc`

**Backend (Railway/Vercel/etc.)**:
- `SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (production service role key)

### Step 6: Verify Fix

1. **Check if merchant profile exists**:
   - Go to Supabase Dashboard → `gawcuwlmvcveddqjjqxc` → Table Editor → `profiles`
   - Check if merchant with phone `+15165879844` exists
   - If exists, verify phone column is not empty

2. **If profile doesn't exist or phone is empty**:
   - The migration should have fixed existing profiles
   - If still empty, merchant needs to sign up through frontend (will now work correctly)

3. **Test SMS Parsing**:
   - Send SMS to Twilio number from `+15165879844`
   - Try: "2pm haircut"
   - Check Edge Functions logs for `parse-sms-opening`
   - Should NOT see "Merchant not found" error

## Files Created/Modified

### New Migrations
- `supabase/migrations/20250127000000_fix_handle_new_user_phone_extraction.sql`
- `supabase/migrations/20250127000001_fix_existing_profiles_empty_phone.sql`

### Updated Configuration
- `supabase/config.toml` ✅

### Updated Documentation (13 files)
- All deployment and setup guides now reference production project

### Assessment Reports Created
- `docs/PRODUCTION_ASSESSMENT_COMPLETE.md`
- `docs/PRODUCTION_FIX_IMPLEMENTATION_SUMMARY.md`
- `docs/PRODUCTION_FIX_ACTION_PLAN.md` (this file)

## Expected Result

After completing the steps above:
- ✅ SMS parsing will find merchants by phone number
- ✅ "Merchant not found" error will be resolved
- ✅ New merchant signups will have phone numbers correctly stored
- ✅ Production database fully configured and working






