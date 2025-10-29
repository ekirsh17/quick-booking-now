# Development Features Guide

⚠️ **IMPORTANT: REMOVE ALL DEVELOPMENT FEATURES BEFORE PRODUCTION**

This document describes temporary features used during development and testing. These must be removed before going live.

---

## Admin Dev Panel (TEMPORARY)

A floating panel for quick navigation between consumer and merchant flows during development and testing.

### What It Does

A floating shield button appears in the bottom-right corner (visible only to users with admin role). Clicking it opens a side drawer with:

**Consumer Flows:**
- Quick link to notification request form
- Quick link to test claim booking flow

**Merchant Flows:**
- Dashboard
- Add Availability
- Analytics  
- Settings

**Developer Info:**
- Current user ID for testing
- Description of the testing panel

### Enabling/Disabling

**Option 1: Environment Variables (Recommended)**

Create `.env.local` in the project root:

```env
# Enable admin dev panel
VITE_ADMIN_PANEL=true

# Show mock data indicators
VITE_MOCK_DATA=true

# Enable debug mode
VITE_DEBUG_MODE=true
```

**Option 2: Feature Config**

Edit `src/config/features.ts`:

```typescript
export const FEATURES = {
  ADMIN_PANEL: false, // Set to false to disable
  MOCK_DATA: false,
  DEBUG_MODE: false,
};
```

### Assigning Admin Role

This is a secure, database-backed system. To assign admin role:

1. Get your user ID from auth (check console logs or backend)
2. Run SQL to assign role:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('YOUR-USER-ID', 'admin');
   ```

### Accessing the Panel

1. Ensure admin role is assigned
2. Ensure `VITE_ADMIN_PANEL=true` in `.env.local`
3. Log in as merchant
4. Look for floating shield button in bottom-right corner
5. Click to open the dev navigation panel

---

## Complete Removal Guide (Before Production)

Follow these steps to remove all development features:

### Step 1: Delete Files

```bash
# Admin dev panel
rm src/components/dev/AdminDevPanel.tsx
rm src/contexts/AdminContext.tsx

# Dev components
rm src/components/dev/DevModeIndicator.tsx

# Feature flag system
rm src/config/features.ts
rm src/hooks/useFeatureFlag.tsx

# Documentation
rm DEV_FEATURES.md
rm .env.local
```

### Step 2: Database Cleanup

Run this SQL to remove admin role system:

```sql
-- Drop policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Drop function
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Drop table
DROP TABLE IF EXISTS public.user_roles;

-- Drop enum
DROP TYPE IF EXISTS public.app_role;
```

### Step 3: Update Code Files

**`src/App.tsx`:**
- Remove `import { AdminProvider } from "@/contexts/AdminContext"`
- Remove `<AdminProvider>` wrapper
- Remove `AdminDevPanel` import and component
- Remove DevModeIndicator import and component

**`src/pages/merchant/Analytics.tsx`:**
- Remove FEATURES import
- Remove mock data badges/indicators

### Step 4: Clean Up Routes

In `src/App.tsx`, ensure only these routes remain:
- `/` - Landing
- `/notify/:businessId` - Consumer notification
- `/claim/:slotId` - Claim booking
- `/booking-confirmed/:slotId` - Booking confirmation
- `/merchant/login` - Merchant login
- `/merchant/dashboard` - Merchant dashboard
- `/merchant/add-availability` - Add availability
- `/merchant/analytics` - Analytics
- `/merchant/settings` - Settings

### Step 5: Environment Variables

Remove from `.env` and `.env.local`:
- `VITE_ADMIN_PANEL`
- `VITE_MOCK_DATA`
- `VITE_DEBUG_MODE`

### Step 6: Verification

- [ ] No admin routes accessible
- [ ] No admin UI elements visible
- [ ] No `user_roles` table in database
- [ ] No feature flag references in code
- [ ] No dev mode indicators
- [ ] All merchant functionality works normally

---

## Current Development Features

### 1. Admin Dev Panel
- **Purpose:** Quick navigation between flows for testing
- **Access:** Floating shield button (bottom-right, admins only)
- **Files:**
  - `src/components/dev/AdminDevPanel.tsx`
  - `src/contexts/AdminContext.tsx`

### 2. Mock Data Indicators
- **Purpose:** Show when sample data is being displayed
- **Files:** Check `src/pages/merchant/Analytics.tsx`

### 3. Debug Mode Indicator
- **Purpose:** Visual reminder that dev features are active
- **Component:** `DevModeIndicator` (bottom-left corner)

---

## Security Notes

✅ **Current Implementation (Secure):**
- Roles stored in separate `user_roles` table
- RLS policies prevent unauthorized access
- Security definer function prevents recursive RLS
- Server-side role validation

❌ **Never Do This:**
- Store roles in localStorage/sessionStorage
- Hardcode admin credentials
- Use client-side only role checks
- Store roles in profiles table (privilege escalation risk)

---

## Questions?

If you're unsure about removing a feature, ask yourself:
1. Does it say "TEMPORARY" in the comments?
2. Is it in the `admin/` or `dev/` directories?
3. Is it referenced in this document?

If yes to any, it should be removed before production.
