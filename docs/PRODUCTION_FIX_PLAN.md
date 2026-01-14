# Production Database Fix Plan

**Based on Assessment**: Production database (`gawcuwlmvcveddqjjqxc`) has tables but is mostly empty, causing SMS parsing to fail.

## Root Cause

The SMS parsing function fails because:
1. `profiles` table in production is empty OR
2. Merchant profile exists but `phone` column is NULL/empty OR  
3. Phone number format doesn't match (not in E.164 format)

## Fix Strategy

### Option 1: Merchant Signup (Recommended)
If production database has all migrations and edge functions:
- Merchant signs up through production frontend
- `verify-otp` function creates auth user
- `handle_new_user` trigger creates profile with phone number
- SMS parsing will then work

### Option 2: Manual Profile Creation
If merchant already has auth user but no profile:
- Create profile manually with correct phone number in E.164 format
- Ensure phone is stored as `+15165879844`

### Option 3: Fix Missing Migrations/Functions
If production is missing migrations or edge functions:
- Run `supabase db push` to apply all migrations
- Run `supabase functions deploy` to deploy all edge functions
- Then proceed with Option 1 or 2

## Immediate Action Items

1. **Verify Production State** (User needs to check in Supabase Dashboard)
   - Check if `profiles` table has any rows
   - Check if merchant with phone +15165879844 exists
   - Check applied migrations count
   - Check edge functions deployment status

2. **Create Merchant Profile** (If missing)
   - Either via signup flow OR
   - Manual SQL insert with correct phone format

3. **Update Configuration Files** (AI will do)
   - Update all files with production project ID
   - Update environment variable references






