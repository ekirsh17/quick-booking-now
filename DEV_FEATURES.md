# Development Features Guide

⚠️ **IMPORTANT: REMOVE ALL DEVELOPMENT FEATURES BEFORE PRODUCTION**

This document describes temporary features used during development and testing. These must be removed before going live.

---

## Admin Panel (TEMPORARY)

The admin panel is a development-only feature for testing and monitoring.

### Enabling/Disabling

**Option 1: Environment Variables (Recommended)**

Create `.env.local` in the project root:

```env
# Enable admin panel
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

Since this is a secure, database-backed system, you need to manually assign the first admin:

1. Open your backend (Lovable Cloud)
2. Go to SQL Editor
3. Get your user ID:
   ```sql
   SELECT id, email FROM auth.users;
   ```
4. Assign admin role (replace `YOUR-USER-ID`):
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('YOUR-USER-ID', 'admin');
   ```

### Accessing Admin Panel

1. Ensure you have admin role assigned
2. Log in to the merchant dashboard
3. Toggle "Admin Mode" in the sidebar
4. Navigate to Admin Dashboard

---

## Complete Removal Guide (Before Production)

Follow these steps to remove all development features:

### Step 1: Delete Files

```bash
# Admin panel files
rm -rf src/pages/admin/
rm src/components/admin/AdminToggle.tsx
rm src/components/admin/AdminBadge.tsx
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
- Remove admin routes (`/admin`, `/admin/*`)
- Remove DevModeIndicator import and component

**`src/components/merchant/MerchantLayout.tsx`:**
- Remove admin-related imports (AdminToggle, AdminBadge, useAdmin)
- Remove `adminMode` state
- Remove AdminToggle component
- Remove AdminBadge component
- Remove admin navigation items

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

### 1. Admin Panel
- **Purpose:** Monitor all merchants, bookings, and system stats
- **Access:** Toggle in merchant sidebar (admins only)
- **Files:**
  - `src/pages/admin/Dashboard.tsx`
  - `src/contexts/AdminContext.tsx`
  - `src/components/admin/*`

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
