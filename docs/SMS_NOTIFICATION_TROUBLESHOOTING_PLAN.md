# SMS Notification Troubleshooting & Implementation Plan

## Problem Statement
Consumer notifications via SMS are not being sent when new openings are created. The `notify-consumers` Edge Function is returning 500 errors.

## Investigation Findings

### Git History Analysis
- **Last working commit**: `61edaf0` - "Implement full notify fixes plan" (Nov 2024)
- **Key commits that may have broken it**:
  - Current HEAD has changes that introduced timezone filtering complexity
  - Column name changes: `business_name` → `name` (already fixed)
  - Merchant ID resolution: `user.id` → `userProfile?.id || user.id`

### Current Issues Identified
1. **500 Errors in Logs**: Function is crashing with 500 status codes
2. **No notifications created**: Database shows 0 notification records
3. **Function deployed but failing**: Version 3 is deployed but returning errors

### Key Differences from Working Version (61edaf0)

#### Working Version:
- Used `user.id` directly for merchantId
- Simpler date filtering (no timezone conversion)
- Used `business_name` from profiles (but this column doesn't exist)
- Simpler slot query without time_zone join

#### Current Version:
- Uses `userProfile?.id || user.id` for merchantId
- Complex timezone-aware date filtering
- Uses `name` from profiles (correct)
- Includes time_zone in profile join

## Implementation Plan

### Phase 1: Immediate Debugging (Priority: CRITICAL)
1. **Check actual error in function logs**
   - Access Supabase dashboard logs for `notify-consumers`
   - Look for specific error messages in recent 500 responses
   - Check for runtime errors vs. database errors

2. **Verify function syntax**
   - Check for missing closing braces or syntax errors
   - Verify all imports are correct
   - Check for undefined variables

3. **Test function manually**
   - Create a test slot
   - Manually invoke the function with known good data
   - Check each step of the execution

### Phase 2: Compare with Working Version
1. **Extract working version logic**
   - Get the exact code from commit `61edaf0`
   - Compare line-by-line with current version
   - Identify what changed that could cause failures

2. **Identify breaking changes**
   - Timezone filtering logic (most likely culprit)
   - Profile query structure
   - Date comparison logic

### Phase 3: Fix Strategy Options

#### Option A: Revert to Working Version (Fastest)
- Restore the function from commit `61edaf0`
- Fix only the `business_name` → `name` issue
- Keep simple date filtering
- **Pros**: Guaranteed to work, minimal changes
- **Cons**: Loses timezone improvements

#### Option B: Fix Current Version (Better long-term)
- Keep timezone-aware filtering
- Fix the specific error causing 500s
- Add better error handling
- **Pros**: Better code, handles timezones correctly
- **Cons**: More complex, may take longer

#### Option C: Hybrid Approach (Recommended)
- Start with working version logic
- Gradually add back improvements
- Test at each step
- **Pros**: Safe, incremental, maintains functionality
- **Cons**: Takes more time

### Phase 4: Testing & Validation
1. **Unit test the function**
   - Test with known slot/merchant/consumer data
   - Verify date filtering works correctly
   - Check SMS sending works

2. **Integration test**
   - Create opening via UI
   - Verify notification is triggered
   - Check SMS is sent
   - Verify notification record is created

3. **Edge case testing**
   - Test with different timezones
   - Test with no matching consumers
   - Test with multiple consumers
   - Test duplicate prevention

## Immediate Action Items

1. ✅ **Check Supabase logs** for actual error message
2. ✅ **Compare current code** with working version
3. ⏳ **Identify root cause** of 500 errors
4. ⏳ **Fix the issue** (revert or patch)
5. ⏳ **Deploy and test**

## Files to Review
- `supabase/functions/notify-consumers/index.ts` - Main function
- `src/pages/merchant/Openings.tsx` - Function invocation
- `supabase/functions/send-sms/index.ts` - SMS sending
- Database: `notify_requests`, `notifications`, `consumers` tables

## Success Criteria
- ✅ Function returns 200 status code
- ✅ SMS messages are sent to consumers
- ✅ Notification records are created in database
- ✅ No 500 errors in logs
- ✅ Consumers receive notifications when openings match their time_range











