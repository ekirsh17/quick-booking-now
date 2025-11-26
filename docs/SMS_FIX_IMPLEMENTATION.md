# SMS Notification Fix Implementation Plan

## Root Cause Analysis

### Findings from Git History
1. **Last Working Commit**: `61edaf0` - "Implement full notify fixes plan"
2. **Key Issue**: The working version used `business_name` (which doesn't exist) but had simpler date filtering
3. **Current Issue**: Complex timezone filtering may be causing runtime errors

### Current Problems
- Function returns 500 errors
- No notifications being sent
- Complex timezone logic may have bugs

## Fix Strategy: Hybrid Approach

### Step 1: Restore Working Logic
- Use the simpler date filtering from commit `61edaf0`
- Fix the `business_name` → `name` issue
- Keep the signed URL generation (that's an improvement)

### Step 2: Simplify Date Filtering
The working version used simple Date comparisons:
```typescript
const slotStartDate = new Date(slot.start_time);
const today = new Date();
today.setHours(0, 0, 0, 0);
// Simple comparisons
```

Current version uses complex timezone string formatting which may have issues.

### Step 3: Test Incrementally
1. First, restore working version with `name` fix
2. Test that it works
3. Then gradually add timezone improvements if needed

## Implementation Steps

1. **Restore working version logic** (from 61edaf0)
2. **Fix column name**: `business_name` → `name`
3. **Keep improvements**: Signed URL generation
4. **Deploy and test**
5. **Add timezone support later** if needed (as separate improvement)

## Files to Modify
- `supabase/functions/notify-consumers/index.ts` - Restore simpler logic



