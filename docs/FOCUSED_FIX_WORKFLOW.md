# Focused Fix Workflow

This document outlines the process for making focused, scoped bug fixes that don't revert or modify unrelated code.

## Core Principle

**When fixing bugs, only modify files directly related to the issue. Never revert or modify unrelated code.**

## Step-by-Step Process

### 1. Identify the Root Cause

Before making any changes:

1. **Read error messages carefully**: Look for specific error text, stack traces, and line numbers
2. **Check logs**: Review application logs, Edge Function logs, or browser console
3. **Trace the code path**: Follow the execution flow from where the error occurs
4. **Document the issue**: Write down:
   - What error occurs
   - When it occurs
   - What triggers it
   - Which files are involved

**Example**:
```
Error: column profiles_1.name does not exist
Location: supabase/functions/notify-consumers/index.ts:40
Trigger: When creating an opening and calling notify-consumers
Files involved: supabase/functions/notify-consumers/index.ts
```

### 2. Scope the Fix

**Ask yourself**:
- Which files are directly involved in this bug?
- What specific changes are needed in each file?
- Are there any dependencies or side effects?
- What files should NOT be touched?

**Create a list**:
```markdown
Files to modify:
- supabase/functions/notify-consumers/index.ts (remove 'name' from join)

Files NOT to modify:
- src/components/billing/* (unrelated)
- src/hooks/useAuth.tsx (unrelated)
- package.json (unrelated)
```

### 3. Make Focused Changes

**Rules**:
1. **One bug = minimal changes**: Fix only what's broken
2. **No refactoring**: Don't improve unrelated code during bug fixes
3. **No style changes**: Don't reformat or restructure unrelated code
4. **Preserve working code**: If it works, don't touch it

**Example - Good**:
```typescript
// BEFORE (broken):
.select('*, profiles!merchant_id(name, business_name, time_zone)')

// AFTER (fixed):
.select(`
  id,
  merchant_id,
  start_time,
  end_time,
  duration_minutes,
  status,
  appointment_name,
  profiles!merchant_id(business_name, time_zone)
`)
```

**Example - Bad**:
```typescript
// Don't do this - too many changes:
.select(`
  id,
  merchant_id,
  start_time,
  end_time,
  duration_minutes,
  status,
  appointment_name,
  profiles!merchant_id(business_name, time_zone)
`)
// ... and then also refactor the entire function
// ... and also fix unrelated issues
// ... and also update dependencies
```

### 4. Verify Changes Before Committing

**Pre-commit checklist**:

```bash
# 1. Review all changed files
git status

# 2. Review diff for each file
git diff <file>

# 3. For each changed file, verify:
#    - Is this file directly related to the bug?
#    - Are the changes minimal and focused?
#    - Are there any unrelated changes?
```

**If unrelated changes are found**:

**Option A: Stash them separately**
```bash
git stash push -m "unrelated changes - billing improvements"
# Then commit only the bug fix
git add <bug-fix-files>
git commit -m "fix: ..."
```

**Option B: Commit them separately**
```bash
# First commit the bug fix
git add <bug-fix-files>
git commit -m "fix: ..."

# Then commit unrelated changes
git add <other-files>
git commit -m "feat: ..."
```

**Option C: Revert them**
```bash
git checkout -- <unrelated-file>
```

### 5. Write Clear Commit Messages

**Format**:
```
fix(scope): Brief description of the fix

- Specific change 1
- Specific change 2
- Specific change 3

Fixes: [error message or issue description]
Error: [exact error if applicable]
```

**Example - Good**:
```
fix(notifications): Fix consumer SMS notification failure

- Remove 'name' column from profiles join query (fixes 'column profiles_1.name does not exist' error)
- Add phone normalization to ConsumerNotify.tsx to ensure E.164 format
- Improve error handling in notify-consumers Edge Function

Fixes: 500 error when creating openings and notifying consumers
Error: column profiles_1.name does not exist
```

**Example - Bad**:
```
fix: stuff
```

### 6. Review Before Pushing

**Before `git push`**:
1. ✅ Review commit message accuracy
2. ✅ Verify only related files are included
3. ✅ Check that commit doesn't include unrelated changes
4. ✅ Ensure commit message documents the fix clearly

**Final check**:
```bash
# Review what will be pushed
git log origin/main..HEAD

# Review the diff
git diff origin/main..HEAD
```

## Examples

### ✅ Good: Focused Fix

**Bug**: `column profiles_1.name does not exist` error in notify-consumers

**Files changed**:
- `supabase/functions/notify-consumers/index.ts` - Removed `name` from join query
- `src/pages/ConsumerNotify.tsx` - Added phone normalization (related to same feature)

**Why it's good**:
- Only 2 files changed
- Both directly related to notification feature
- Changes are minimal and focused
- No unrelated modifications
- Clear commit message

### ❌ Bad: Unfocused Fix

**Bug**: Same notification error

**Files changed**:
- `supabase/functions/notify-consumers/index.ts` - Fixed query
- `src/pages/ConsumerNotify.tsx` - Fixed phone normalization
- `src/components/billing/*` - "While I'm here, let me fix billing"
- `src/hooks/useAuth.tsx` - "Might as well refactor this"
- `package.json` - "Update dependencies"

**Why it's bad**:
- Too many files changed
- Unrelated changes mixed in
- Hard to review and understand
- Risk of introducing new bugs
- Unclear what the commit actually fixes

## Common Pitfalls

### ❌ "While I'm Here" Syndrome

**Problem**: Making unrelated improvements during bug fixes

**Example**:
```typescript
// Fixing notification bug, but also:
- Refactoring auth logic
- Updating billing components
- Fixing typos in comments
- Reformatting code
```

**Solution**: Make separate commits for separate concerns

### ❌ Formatting Changes

**Problem**: Reformatting code during bug fixes

**Example**:
```typescript
// Fixing bug but also:
- Changing indentation
- Reordering imports
- Renaming variables (unrelated to bug)
```

**Solution**: Only format code directly related to the fix

### ❌ Bulk Changes

**Problem**: Modifying multiple unrelated files

**Example**:
```bash
# Fixing one bug but changing:
- 20 files in billing/
- 10 files in auth/
- 5 files in components/
```

**Solution**: Change only files directly involved in the bug

### ❌ Undoing Working Code

**Problem**: Reverting unrelated changes that were working

**Example**:
```typescript
// Fixing notification bug but also:
- Reverting billing improvements
- Undoing auth refactoring
- Removing unrelated features
```

**Solution**: Only revert code directly related to the bug

## Git Workflow for Isolating Changes

### Scenario 1: You Have Unrelated Changes

```bash
# 1. Stash unrelated changes
git stash push -m "unrelated work in progress"

# 2. Make and commit the bug fix
git add <bug-fix-files>
git commit -m "fix: ..."

# 3. Restore unrelated changes
git stash pop
```

### Scenario 2: You Accidentally Modified Unrelated Files

```bash
# 1. See what you changed
git status

# 2. Revert unrelated files
git checkout -- <unrelated-file>

# 3. Commit only the fix
git add <bug-fix-files>
git commit -m "fix: ..."
```

### Scenario 3: You Want to Commit Separately

```bash
# 1. Stage only bug fix files
git add <bug-fix-file-1> <bug-fix-file-2>
git commit -m "fix: ..."

# 2. Stage unrelated changes
git add <other-files>
git commit -m "feat: ..."
```

## Testing After Fix

### Focus Testing

**Test only**:
1. The specific bug that was fixed
2. Related functionality that might be affected
3. Regression testing for the changed code paths

**Don't test**:
- Unrelated features
- Entire application (unless the fix is critical infrastructure)

**Example**:
```
Bug: Notification Edge Function 500 error

Test:
✅ Create opening → verify notification sent
✅ Check Edge Function logs for success
✅ Verify SMS received

Don't test:
❌ Entire billing flow
❌ All authentication paths
❌ All Edge Functions
```

## Emergency Fixes

For critical production bugs, the same principles apply:

1. **Still scope the fix**: Don't panic and change everything
2. **Still review changes**: Verify before committing
3. **Still document clearly**: Future you will thank present you
4. **Consider hotfix branch**: If main has other changes

```bash
# Create hotfix branch
git checkout -b hotfix/notification-fix

# Make focused fix
# ... make changes ...

# Review and commit
git add <fix-files>
git commit -m "fix: ..."

# Merge to main
git checkout main
git merge hotfix/notification-fix
```

## Review Checklist

Before committing any bug fix, verify:

- [ ] Only files directly related to the bug are changed
- [ ] Changes are minimal and focused
- [ ] No unrelated code modifications
- [ ] No formatting or style changes (unless directly related)
- [ ] No refactoring of unrelated code
- [ ] Commit message clearly describes the fix
- [ ] Error message or issue is documented
- [ ] Git diff reviewed for any accidental changes
- [ ] Testing focused on the specific fix

## Related Documentation

- [Cursor Rules: Focused Fixes](.cursor/rules/focused_fixes.mdc) - Internal guidelines for AI agents
- [Git Best Practices](https://git-scm.com/book) - General git workflow
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format

## Questions to Ask Before Every Fix

1. **What is the exact error?** (Get the full error message)
2. **Which files are directly involved?** (List them)
3. **What is the minimal change needed?** (One line? One function? One file?)
4. **Are there any unrelated changes?** (Review git diff)
5. **Is the commit message clear?** (Can someone understand what was fixed?)

If you can't answer these clearly, you're not ready to commit.

