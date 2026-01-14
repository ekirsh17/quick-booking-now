# Production Database Fix - Implementation Summary

**Date**: 2025-01-27  
**Production Project**: `gawcuwlmvcveddqjjqxc`  
**Production URL**: `https://gawcuwlmvcveddqjjqxc.supabase.co`

## Root Cause Identified

**CRITICAL BUG**: The `handle_new_user` trigger function was only reading phone from `raw_user_meta_data->>'phone'`, but when `verify-otp` creates users, it sets the phone in `auth.users.phone`, NOT in `raw_user_meta_data`. This caused profiles to be created with **empty phone strings**, making SMS parsing fail with "Merchant not found" error.

## Fixes Implemented

### 1. Created Migration to Fix `handle_new_user` Function
**File**: `supabase/migrations/20250127000000_fix_handle_new_user_phone_extraction.sql`

- Updated function to use `NEW.phone` (from `auth.users.phone`) as fallback
- Now properly extracts phone number when created via `verify-otp` function
- Maintains backward compatibility with `raw_user_meta_data` approach

### 2. Created Migration to Fix Existing Profiles
**File**: `supabase/migrations/20250127000001_fix_existing_profiles_empty_phone.sql`

- Updates existing profiles that have empty phone numbers
- Copies phone from `auth.users.phone` to `profiles.phone` where missing
- Only updates profiles where auth user has a phone number

### 3. Updated Configuration Files
**Updated Files**:
- ✅ `supabase/config.toml` - Changed project_id to `gawcuwlmvcveddqjjqxc`
- ✅ `scripts/create-env-files.js` - Updated project ID
- ✅ `docs/DEPLOYMENT_ENV.md` - Updated all references
- ✅ `docs/EDGE_FUNCTIONS_SETUP.md` - Updated URLs and project ID
- ✅ `docs/RAILWAY_DEPLOYMENT.md` - Updated Supabase URL
- ✅ `docs/DEPLOYMENT_ENV_VARS.md` - Updated all references
- ✅ `docs/BOOKING_LINKS_FIX.md` - Updated project references
- ✅ `server/README.md` - Updated project references
- ✅ `docs/EDGE_FUNCTIONS_ENV.md` - Updated all references
- ✅ `docs/EDGE_FUNCTIONS_ENV_VARS.md` - Updated all references
- ✅ `docs/SETUP_TWILIO_ENV_VARS.md` - Updated project ID and URLs
- ✅ `docs/NOTIFICATION_ISSUE_DIAGNOSIS.md` - Updated URLs
- ✅ `README.md` - Updated project references

**Total Files Updated**: 13 files

## Next Steps (User Actions Required)

### Step 1: Link CLI to Production
```bash
supabase link --project-ref gawcuwlmvcveddqjjqxc
```

### Step 2: Push Migrations to Production
```bash
supabase db push
```
This will:
- Apply the two new fix migrations
- Ensure all other migrations are applied
- Fix the `handle_new_user` function
- Fix existing profiles with empty phone numbers

### Step 3: Deploy Edge Functions
```bash
supabase functions deploy
```
This ensures all edge functions are deployed to production.

### Step 4: Verify Fix
1. Check Supabase Dashboard → `gawcuwlmvcveddqjjqxc` → Table Editor → `profiles`
2. Verify merchant profile exists with phone `+15165879844`
3. If profile exists but phone is empty, the migration should have fixed it
4. If profile doesn't exist, merchant needs to sign up through frontend

### Step 5: Test SMS Parsing
1. Send SMS to Twilio number from `+15165879844`
2. Try: "2pm haircut"
3. Check Edge Functions logs for `parse-sms-opening`
4. Verify no "Merchant not found" error
5. Verify appointment is created

## Expected Outcome

After migrations are applied:
- ✅ `handle_new_user` function correctly extracts phone from `auth.users.phone`
- ✅ Existing profiles with empty phones are updated
- ✅ New merchant signups will have phone numbers in profiles
- ✅ SMS parsing will find merchants by phone number
- ✅ "Merchant not found" error will be resolved

## Additional Notes

- The fix is backward compatible - still checks `raw_user_meta_data` first
- The migration to fix existing profiles is idempotent (safe to run multiple times)
- All configuration files now point to production project
- MCP connection may need to be updated in environment configuration to point to production






