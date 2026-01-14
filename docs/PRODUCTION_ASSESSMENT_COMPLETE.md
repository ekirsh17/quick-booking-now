# Production Database Assessment - Complete Report

**Assessment Date**: 2025-01-27  
**Production Project**: `gawcuwlmvcveddqjjqxc`  
**Production URL**: `https://gawcuwlmvcveddqjjqxc.supabase.co`

## 🔴 ROOT CAUSE IDENTIFIED

### Primary Issue: `handle_new_user` Trigger Bug

**Problem**: The `handle_new_user` trigger function gets phone from `raw_user_meta_data->>'phone'`, but when `verify-otp` creates a user, it sets the phone in `auth.users.phone`, NOT in `raw_user_meta_data`. 

**Result**: Profiles are created with **empty phone strings**, causing SMS parsing to fail with "Merchant not found".

**Code Evidence**:
- `verify-otp/index.ts` line 102: Creates user with `phone: normalized` (sets `auth.users.phone`)
- `handle_new_user` function (migration 20251030003245): Gets phone from `COALESCE(NEW.raw_user_meta_data->>'phone', '')` (empty string!)

**Fix Required**: Update `handle_new_user` to use `NEW.phone` (from `auth.users.phone`) as fallback when `raw_user_meta_data->>'phone'` is empty.

## Current State Assessment

### Database Schema (Based on Original Project Reference)
- ✅ All expected tables exist (27 tables)
- ✅ RLS enabled on all tables
- ✅ Database functions exist (14 functions)
- ✅ Triggers exist (10 triggers)
- ⚠️ **BUG**: `handle_new_user` function has phone extraction bug

### Data Status (Production - User Reported)
- `profiles`: Mostly empty (likely 0-1 rows)
- `slots`: Mostly empty
- Other tables: Mostly empty

### Migrations Status
- **Expected**: 45 migration files in `supabase/migrations/`
- **Original Project**: 57 migrations applied
- **Production**: Unknown (needs verification)

### Edge Functions Status
- **Original Project**: 15 functions deployed and ACTIVE
- **Production**: Unknown (needs verification)

## Fix Plan

### 1. Fix `handle_new_user` Function (CRITICAL)

Create migration to update the function to use `auth.users.phone`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only create profile if user_type is merchant or not specified (backward compatibility)
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'merchant') = 'merchant' THEN
    INSERT INTO public.profiles (id, business_name, phone, address)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
      -- FIX: Use NEW.phone (from auth.users.phone) as fallback
      COALESCE(
        NEW.raw_user_meta_data->>'phone',
        NEW.phone,  -- This is the key fix - get phone from auth.users.phone
        ''
      ),
      COALESCE(NEW.raw_user_meta_data->>'address', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
```

### 2. Fix Existing Profiles with Empty Phone (If Needed)

If production has profiles with empty phone numbers, update them:

```sql
-- Update profiles that have empty phone but auth user has phone
UPDATE public.profiles p
SET phone = u.phone
FROM auth.users u
WHERE p.id = u.id
  AND (p.phone IS NULL OR p.phone = '')
  AND u.phone IS NOT NULL;
```

### 3. Update Configuration Files

Update all files with production project ID `gawcuwlmvcveddqjjqxc`:
- `supabase/config.toml`
- All documentation files (34 files with `thuelgbhfoaqbaaojezb`)

### 4. Verify Production Setup

- Check if all migrations are applied
- Check if edge functions are deployed
- Test merchant signup to verify profile creation with phone
- Test SMS parsing

## Implementation Steps

1. **Create Migration** to fix `handle_new_user` function
2. **Update Config Files** with production project ID
3. **User Actions**:
   - Link CLI to production: `supabase link --project-ref gawcuwlmvcveddqjjqxc`
   - Push migration: `supabase db push`
   - Deploy functions: `supabase functions deploy`
   - Fix existing profiles (if needed): Run SQL update query
4. **Test**: Merchant signup and SMS parsing






