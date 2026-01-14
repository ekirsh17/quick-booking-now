# Production Database Assessment Report

**Assessment Date**: 2025-01-27  
**Production Project**: `gawcuwlmvcveddqjjqxc`  
**Production URL**: `https://gawcuwlmvcveddqjjqxc.supabase.co`

## ⚠️ CRITICAL FINDING

**MCP Connection Issue**: The MCP tools are currently connected to the **original project** (`thuelgbhfoaqbaaojezb`), NOT the production project (`gawcuwlmvcveddqjjqxc`). 

**This means all queries above are from the original project, not production.**

To properly assess production, we need to either:
1. Update MCP connection configuration to point to production
2. Or use direct SQL queries with production credentials

## Current Assessment (Based on Original Project for Reference)

### Database Tables Status
- ✅ All expected tables exist
- ✅ RLS is enabled on all tables
- ✅ Table structures match expected schema

### Data Status (Original Project - NOT Production)
- `profiles`: 2 rows (has merchant with phone +15165879844)
- `slots`: 36 rows
- `consumers`: 1 row
- `sms_intake_logs`: 19 rows
- `sms_intake_state`: 0 rows
- `otp_codes`: 4 rows
- `notifications`: 8 rows
- `sms_logs`: 0 rows

### Migrations Status (Original Project)
- ✅ 57 migrations applied
- All migrations from `supabase/migrations/` appear to be applied

### Edge Functions Status (Original Project)
- ✅ 15 edge functions deployed and ACTIVE
- All critical functions exist: `parse-sms-opening`, `send-sms`, `verify-otp`, `generate-otp`, etc.

### SMS Parsing Issue Analysis (Based on Code Review)

**Root Cause Identified**:
The `parse-sms-opening` function (lines 85-89) queries:
```typescript
const { data: merchant, error: merchantError } = await supabase
  .from('profiles')
  .select('id, business_name, time_zone, saved_appointment_names, saved_durations, default_opening_duration, working_hours')
  .eq('phone', fromNumber)
  .single();
```

**The error "Merchant not found" with PGRST116 means**:
- The query returned 0 rows (no merchant found with that phone number)
- This happens when:
  1. `profiles` table is empty in production
  2. OR merchant profile exists but `phone` column is NULL or empty
  3. OR phone number format doesn't match (e.g., stored as "15165879844" instead of "+15165879844")

## Next Steps Required

### 1. Verify Production Database State
Need to query production database directly to check:
- [ ] Row counts in production `profiles` table
- [ ] If merchant with phone +15165879844 exists in production
- [ ] Phone number format in production profiles
- [ ] Applied migrations in production
- [ ] Edge functions deployed in production

### 2. Fix Strategy (Based on Findings)

**If profiles table is empty**:
- Merchant needs to sign up through frontend
- OR manually create merchant profile with correct phone number

**If merchant exists but phone is NULL/empty**:
- Update existing merchant profile with phone number
- Ensure phone is in E.164 format: `+15165879844`

**If phone format mismatch**:
- Normalize phone numbers in database to E.164 format
- Update `parse-sms-opening` function to handle format variations (if needed)

**If migrations missing**:
- Run `supabase db push` to apply missing migrations

**If edge functions missing**:
- Run `supabase functions deploy` to deploy functions

## Files That Need Updating

Once production is confirmed working, update these files with production project ID `gawcuwlmvcveddqjjqxc`:

1. `supabase/config.toml`
2. `docs/DEPLOYMENT_ENV.md`
3. `docs/EDGE_FUNCTIONS_SETUP.md`
4. `docs/RAILWAY_DEPLOYMENT.md`
5. `scripts/create-env-files.js`
6. All other files with `thuelgbhfoaqbaaojezb` (34 files total)






