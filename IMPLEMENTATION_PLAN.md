# Last-Minute Booking Notification System - Implementation Plan (Updated)

**Date**: January 2025  
**Status**: In Progress - Phase 1

> **Note**: The previous architectural plan has been preserved in `IMPLEMENTATION_PLAN_LEGACY.md` for reference. It contains valuable information about the original system design, RLS policies, and Phase 2 multi-chair architecture that has already been partially implemented.

## Overview
This plan organizes 15 requested improvements into 5 strategic phases, prioritizing critical UI/UX fixes before larger feature additions.

---

## Phase 1: Critical UI/UX Fixes & Polish (3-5 days)
**Priority**: HIGH - Immediate user experience improvements  
**Status**: In Progress

### 1.1 Fix Claim Slot Time Display ✅
**Issue**: Appointment time not showing correctly on claim page  
**Files**: `src/pages/ClaimBooking.tsx`  
**Solution**: Ensure `start_time` from slot is properly formatted and displayed

### 1.2 Fix Floating Button Positioning
**Issue**: "Add Opening" and "Save" buttons block working hours selector on desktop/mobile  
**Files**: 
- `src/pages/merchant/Openings.tsx` (floating add button)
- `src/components/merchant/openings/OpeningModal.tsx` (modal buttons)

**Solution**: 
- Adjust z-index and positioning to prevent overlap
- Ensure buttons are visible and accessible on mobile modal

### 1.3 Fix Calendar Height & Y-Axis
**Issue**: Calendar scroll behavior and slot visibility problems  
**Files**: 
- `src/components/merchant/openings/DayView.tsx`
- `src/components/merchant/openings/WeekView.tsx`

**Solution**: 
- Set proper min-height and scroll container
- Adjust time slot grid to show all relevant hours
- Ensure proper vertical alignment of openings

### 1.4 Verify Weekly View Click-to-Add
**Issue**: Need to ensure weekly view has same click functionality as day view  
**Files**: `src/components/merchant/openings/WeekView.tsx`  
**Solution**: Verify `onTimeSlotClick` is properly wired up for all days

### 1.5 Monthly View "X Open" Color
**Issue**: Text color should match app theme (orange)  
**Files**: `src/components/merchant/openings/MonthView.tsx`  
**Solution**: Change text color from default to `text-accent` (orange)

### 1.6 Add Calendar Legend
**Issue**: Users don't know what blue/orange/yellow slots mean  
**Files**: All calendar view components  
**Solution**: Add a simple legend component:
- Blue = Booked
- Orange = Open
- Yellow/Amber = Pending Confirmation

### 1.7 Sticky Calendar Headers
**Issue**: Headers scroll out of view when scrolling through calendar  
**Files**: `DayView.tsx`, `WeekView.tsx`, `MonthView.tsx`  
**Solution**: Add `sticky top-0 z-10` classes to header rows

### 1.8 Auto-Save Appointment Types/Durations
**Issue**: New values in combobox should save to database immediately  
**Files**: 
- `src/components/merchant/openings/OpeningModal.tsx`
- `src/hooks/useMerchantProfile.tsx`

**Solution**: 
- On "Add" click in combobox, update `saved_appointment_names` or `saved_durations` in profile
- Trigger database update and local state refresh
- Auto-populate the input field with newly saved value

### 1.9 Improve QR Code Link Copy UX
**Issue**: Share booking link should be copyable  
**Files**: `src/pages/merchant/QRCode.tsx`  
**Solution**: Add copy-to-clipboard button with toast confirmation

---

## Phase 2: Consumer Authentication Enhancement (4-6 days)
**Priority**: MEDIUM - Improves user experience and security  
**Dependencies**: Phase 1 complete

### 2.1 Unified 2FA Flow Implementation
**Goal**: Single authentication flow for both new and returning consumers

### Architecture
```
Phone Entry → Lookup Account → OTP Verification → Auto-Fill Name
     ↓              ↓                  ↓                 ↓
  Required    (if exists)         (if exists)      (if exists)
```

### Database Check Flow
1. Consumer enters phone number
2. System checks `consumers` table for existing `user_id`
3. If `user_id` exists → Send OTP → Verify → Auto-fill name
4. If no `user_id` → Continue as guest → Prompt for name

### Implementation Tasks
- Update `ClaimBooking.tsx` and `ConsumerNotify.tsx` with unified flow
- Create `useConsumerAuth.tsx` hook for phone lookup + OTP
- Add rate limiting to prevent OTP spam (max 3 attempts per 5 minutes)
- Display clear messaging: "We found your account" vs "Continue as guest"
- Ensure smooth UX transition between guest and authenticated flows

### Security Measures
- Rate limit OTP requests per phone number
- Add CAPTCHA for repeated failed attempts (optional)
- Log authentication attempts for monitoring

---

## Phase 3: Merchant Dashboard Expansion (5-7 days)
**Priority**: MEDIUM - Enhances merchant capabilities  
**Dependencies**: Phase 1 complete

### 3.1 Reorganize Settings Page
**Current Issue**: Settings page is flat and unorganized  
**Files**: `src/pages/merchant/Settings.tsx`

**New Structure**:
```
Settings (with tabs or accordion)
├── Business Profile
│   ├── Business Name
│   ├── Phone Number
│   ├── Address
│   └── Booking URL
├── Working Hours
│   └── Day-by-day schedule
├── Appointment Settings
│   ├── Default Duration
│   ├── Saved Durations
│   ├── Saved Appointment Names
│   └── Require Confirmation Toggle
├── Staff Management (Phase 4)
└── Billing (Phase 5)
```

**Implementation**:
- Use Tabs component from shadcn/ui
- Group related settings logically
- Add save buttons per section (not single global save)
- Mobile-responsive accordion alternative

### 3.2 Create Notify List Page
**New Page**: `/merchant/notify-list`  
**Purpose**: Show all consumers who signed up for notifications

**Features**:
- Display all `notify_requests` for merchant's business
- Show consumer name, phone, time preference, created date
- Filter by time range ("today", "this_week", "any_time")
- Search by name or phone
- Real-time updates when new requests come in
- Export to CSV functionality
- Delete/archive requests

**UI Components**:
- Table with sorting capabilities
- Filter dropdown (time range)
- Search input
- Real-time badge showing "X new requests today"

---

## Phase 4: Multi-Chair/Staff Support (7-10 days)
**Priority**: MEDIUM-HIGH - Key differentiator feature  
**Dependencies**: Phases 1 & 3 complete

### 4.1 Leverage Existing `staff` Table
**Good News**: `staff` table already exists in database!  
**Columns**: `id`, `merchant_id`, `name`, `phone`, `email`, `color`, `is_primary`, `active`

### 4.2 Staff Management UI
**New Section**: Settings → Staff Management

**Features**:
- List all staff members for the business
- Add new staff member (name, phone, color)
- Edit existing staff (change name, color)
- Deactivate staff (soft delete - set `active = false`)
- Mark primary staff member

**Validation**:
- Cannot delete last active staff member
- Primary staff member cannot be deactivated unless another is marked primary

### 4.3 Update Opening Creation Flow
**Files**: `src/components/merchant/openings/OpeningModal.tsx`

**Changes**:
- Add "Staff Member" dropdown selector
- Default to logged-in merchant (if they're in staff table)
- Allow filtering calendar by staff member
- Save `staff_id` when creating opening

### 4.4 Calendar View Updates
**Files**: `DayView.tsx`, `WeekView.tsx`

**Changes**:
- Color-code openings by staff member (use `staff.color`)
- Add staff name badge on opening cards
- Filter toggle: "All Staff" vs individual staff members
- Legend shows staff colors

### 4.5 SMS Notification Updates
**Files**: `supabase/functions/notify-consumers/index.ts`

**Changes**:
- Include staff member name in SMS text
- Example: "Sarah has an opening at 2:00 PM today at Evan's Cuts"

### Implementation Notes
- **Keep it simple**: No separate staff logins (Phase 6+)
- Staff are managed by business owner only
- All staff share same notification list
- Focus on calendar organization and customer clarity

---

## Phase 5: Monetization & Onboarding (10-14 days)
**Priority**: HIGH - Revenue generation  
**Dependencies**: Phases 1-4 complete (Phase 4 can be parallel)

### 5.1 Stripe Integration
**Goal**: Monthly subscription billing

**Pricing Structure** (to be finalized):
```
Free Tier:
- 1 staff member
- 10 SMS notifications/month
- Basic features

Pro Tier ($29/month):
- Up to 5 staff members
- 100 SMS notifications/month
- Priority support
- Advanced analytics

Business Tier ($79/month):
- Unlimited staff
- 500 SMS notifications/month
- Custom branding
- API access
```

**Implementation**:
- Install Stripe SDK
- Create Stripe products/prices
- Add `subscription_tier`, `stripe_customer_id`, `stripe_subscription_id` to `profiles` table
- Create Stripe webhook handler edge function
- Build billing page in settings
- Add usage tracking for SMS sends
- Display current usage vs limit
- Upgrade/downgrade flow

### 5.2 Merchant Onboarding Flow
**New Page**: `/merchant/onboarding` (shown on first login)

**4-Step Wizard**:
```
Step 1: Business Basics
- Business Name *
- Phone Number *
- Address

Step 2: Business Metrics
- Average Appointment Value ($) *
- How often do you have cancellations? (dropdown)
  - Rarely (1-2/week)
  - Sometimes (3-5/week)
  - Often (5+/week)
- How many appointments per day? (number input)

Step 3: Working Hours
- Set default working hours per day
- Use working hours component from Settings

Step 4: Share Your Link
- Generate QR code
- Show notification signup URL
- Quick guide: "Print this QR code and display it in your business"
```

**Database Changes**:
- Add `onboarding_completed` boolean to `profiles`
- Add `avg_appointment_value`, `cancellation_frequency`, `daily_appointments` columns
- Redirect to onboarding if `onboarding_completed = false`

### 5.3 Analytics Dashboard Enhancements
**Use Collected Metrics** (from onboarding):
- Calculate potential revenue from notifications
- Show conversion rate (notifications sent → bookings made)
- Display ROI: "You've made $X from Y filled slots"

---

## Execution Plan

### Immediate Next Steps (Phase 1 - Week 1)
1. Fix claim slot time display
2. Fix floating button z-index issues
3. Adjust calendar height and scroll
4. Add orange color to monthly view
5. Create and add calendar legend component
6. Make headers sticky
7. Implement auto-save for appointment types
8. Add copy button to QR code page

### Week 2 (Phase 2 Start)
- Design unified authentication flow
- Implement phone lookup logic
- Add OTP verification for returning users
- Test guest vs authenticated flows

### Week 3 (Phase 3)
- Reorganize settings page with tabs
- Build notify list page
- Add filters and search
- Test real-time updates

### Week 4 (Phase 4)
- Create staff management UI
- Add staff selector to opening modal
- Color-code calendar by staff
- Update SMS notifications with staff names

### Week 5-6 (Phase 5)
- Integrate Stripe
- Build billing page
- Create onboarding flow
- Test subscription webhooks
- Launch! 🚀

---

## Success Metrics

### Phase 1 Success
- All calendar views are responsive and performant
- No UI blocking issues
- User can easily understand slot statuses
- New appointment types save automatically

### Phase 2 Success
- Returning users auto-authenticated in <3 seconds
- <5% OTP verification failure rate
- Clear distinction between guest and authenticated flows

### Phase 3 Success
- Settings page is organized and easy to navigate
- Merchants can view all notification requests in one place
- Real-time updates work consistently

### Phase 4 Success
- Multiple staff members can be managed per business
- Calendar clearly shows which staff has which openings
- SMS includes staff member name

### Phase 5 Success
- Payment processing works without errors
- Onboarding completion rate >80%
- Subscription webhooks handle all edge cases
- Clear upgrade path for users hitting limits

---

## Technical Debt & Future Improvements

### Future Phases (Post-Launch)
- Email notifications (in addition to SMS)
- Calendar export (.ics files)
- Reminders for upcoming appointments
- Customer feedback/ratings system
- Mobile app (React Native)
- Advanced analytics (conversion tracking, revenue reporting)
- API for third-party integrations
- White-label solution for larger businesses

---

## Notes & Implementation Decisions

### Q: Should 2FA be optional for consumers?
**Decision**: Make it seamless, not optional
- Phone entry is required (we need it for SMS)
- If account exists, auto-verify (better security)
- If no account, continue as guest (no friction)
- Best of both worlds: security for returning users, simplicity for new users

### Q: How should multi-chair calendar display work?
**Decision**: Filter + color-coding approach
- Default view: Show all staff, color-coded
- Add filter dropdown: "All Staff" or individual staff member
- Use staff.color for visual distinction
- Keep it simple for first iteration

### Q: Preferred billing model?
**Decision**: Monthly subscription + usage-based overage
- Base subscription includes X SMS
- Additional SMS charged at $0.05 each
- Clear usage dashboard so merchants aren't surprised
- Option to set SMS limit to prevent overspending

### Q: Should onboarding be mandatory?
**Decision**: Yes, but skippable
- Show onboarding on first login
- Allow "Skip for now" button
- Collect critical data (business name, phone) before skip is allowed
- Remind to complete onboarding via banner in dashboard
- Gate certain features behind completed onboarding (e.g., multiple staff)

---

## Database Schema Changes Summary

### Phase 1 (No schema changes)
- Uses existing tables

### Phase 2 (No schema changes)
- Uses existing `consumers` table and `user_id` column

### Phase 3 (No schema changes)
- Uses existing `notify_requests` table

### Phase 4 (Uses existing schema!)
- `staff` table already exists
- May need to add default data for existing merchants

### Phase 5 (Schema changes required)
```sql
-- Add subscription fields to profiles
ALTER TABLE profiles
ADD COLUMN subscription_tier text DEFAULT 'free',
ADD COLUMN stripe_customer_id text,
ADD COLUMN stripe_subscription_id text,
ADD COLUMN onboarding_completed boolean DEFAULT false,
ADD COLUMN cancellation_frequency text,
ADD COLUMN daily_appointments integer;

-- Track SMS usage
CREATE TABLE sms_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  month date NOT NULL, -- First day of month
  sms_sent integer DEFAULT 0,
  sms_limit integer DEFAULT 10, -- Based on tier
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(merchant_id, month)
);
```

---

## Rollback Strategy

### Phase 1 Rollback
- Revert component changes via git
- No database changes to rollback

### Phase 2 Rollback
- Revert to guest-only flow
- No schema changes to rollback

### Phase 3 Rollback
- Hide notify list page
- Revert settings reorganization

### Phase 4 Rollback
- Hide staff management UI
- Keep schema (already exists)
- Openings default to merchant_id only

### Phase 5 Rollback
```sql
-- Remove subscription columns
ALTER TABLE profiles
DROP COLUMN IF EXISTS subscription_tier,
DROP COLUMN IF EXISTS stripe_customer_id,
DROP COLUMN IF EXISTS stripe_subscription_id,
DROP COLUMN IF EXISTS onboarding_completed,
DROP COLUMN IF EXISTS cancellation_frequency,
DROP COLUMN IF EXISTS daily_appointments;

-- Drop usage table
DROP TABLE IF EXISTS sms_usage;
```

---

**Last Updated**: January 2025  
**Maintained By**: Development Team  
**Status**: Phase 1 - Ready to Begin
