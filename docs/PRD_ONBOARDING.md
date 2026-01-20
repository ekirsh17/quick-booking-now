# OpenAlert Merchant Onboarding - Product Requirements Document

## Document Version
- **Version**: 1.1
- **Created**: 2024-11-26
- **Updated**: 2024-11-26
- **Author**: AI Assistant
- **Status**: ✅ Implemented

---

## 1. Executive Summary

### Overview
A streamlined 4-step onboarding wizard for new OpenAlert merchants that captures essential information quickly while using sensible defaults. The goal is to reduce time-to-value and get merchants posting their first opening within 2 minutes of account creation.

### Problem Statement (Pre-Implementation)
New merchants landed directly on the Openings page after signup with:
- No timezone configured (defaults to Eastern)
- No appointment types or duration presets
- No guidance on how to use the app
- High friction to first value (posting an opening)

### Solution Implemented
A 4-step onboarding wizard that:
- Auto-detects and confirms timezone
- Seeds sensible default presets
- Guides users to create their first opening
- Allows skipping for power users

### Success Metrics
| Metric | Target |
|--------|--------|
| Onboarding completion rate | >90% |
| Time to first opening | <3 minutes |
| Time in onboarding flow | <90 seconds |
| User satisfaction (NPS) | >40 |

---

## 2. Best Practices Research Summary

### Industry Standards for SaaS/Mobile Onboarding

#### Progressive Disclosure
Modern onboarding best practices favor **progressive disclosure** - showing only what's needed at each step rather than overwhelming users upfront.

**Key Principles Applied:**
1. **Minimal Viable Input** - Only ask for timezone (business name/phone already collected at signup)
2. **Smart Defaults** - Pre-populate appointment types and durations
3. **Skip Options** - Let power users bypass with "Skip setup for now"
4. **Deferred Configuration** - Working hours, calendar integration, etc. remain in Settings

#### Competitor Analysis

| App | Onboarding Steps | Time to Value | Key Pattern |
|-----|-----------------|---------------|-------------|
| Calendly | 4 steps | ~2 min | Timezone + availability first |
| Square Appointments | 3 steps | ~2 min | Business info + first service |
| Acuity | 5 steps | ~3 min | Guided wizard with skip |
| Booksy | 3 steps | ~90 sec | Quick start + refine later |

#### Best Practices Applied to OpenAlert

1. **Welcome with Value Proposition** (2-3 seconds)
   - Brief, visual explanation of what user can do
   - Single CTA to continue

2. **Essential Info Only** (~10 seconds)
   - Timezone selection (auto-detected with override)
   - Browser timezone detection via `Intl.DateTimeFormat`

3. **Quick Preset Setup** (~30 seconds)
   - Pre-seeded appointment types and durations
   - Editable chips with add/remove

4. **First Action Prompt** (~5 seconds)
   - Create first opening CTA
   - Option to explore dashboard instead

---

## 3. Merchant Settings Audit & Categorization

### Actual Profile Schema (Verified)

Based on `src/integrations/supabase/types.ts`, the actual `profiles` table schema is:

```typescript
interface MerchantProfile {
  // Identity (collected at signup)
  id: string;                     // UUID from auth.users
  name: string | null;            // Legacy field (used in some places)
  business_name: string | null;   // Preferred business name field
  phone: string | null;           // E.164 format, also used for auth
  address: string | null;         // Optional, collected at signup
  
  // Configuration
  time_zone: string | null;                 // Default: "America/New_York"
  default_opening_duration: number | null;  // Default: 30 (minutes)
  working_hours: Json | null;               // Default: All days 06:00-20:00
  
  // Booking Behavior
  require_confirmation: boolean | null;     // Default: false
  use_booking_system: boolean | null;       // Default: false
  booking_url: string | null;               // External booking URL
  
  // Onboarding Tracking (Added)
  onboarding_completed_at: string | null;   // NULL = not completed
  onboarding_step: number | null;           // 0-5 state machine
  
  // Timestamps
  created_at: string | null;
}
```

> **Note:** The schema has both `name` and `business_name` fields due to legacy evolution. The `name` field is used in some existing code, while `business_name` is the preferred field for new features.

### Related Data Tables

| Table | Purpose | Used in Onboarding |
|-------|---------|-------------------|
| `appointment_type_presets` | Service labels (e.g., "Consultation") | ✅ Seeded with defaults |
| `duration_presets` | Time options (e.g., "30m", "1h") | ✅ Seeded with defaults |
| `staff` | Team members | ❌ No |
| `external_calendar_accounts` | Google Calendar sync | ❌ No |
| `qr_codes` | Marketing QR codes | ❌ No |

### Categorization

#### 🔴 Essential for Onboarding (Must Collect/Confirm)
| Field | Why Essential | Default |
|-------|--------------|---------|
| `time_zone` | Critical for scheduling accuracy | Browser-detected via `Intl.DateTimeFormat` |

> Note: `business_name` and `phone` are already collected during signup

#### 🟡 Helpful in Onboarding (Auto-Seeded, Editable)
| Data | Why Helpful | Defaults |
|------|------------|----------|
| `appointment_type_presets` | Speeds up opening creation | "Consultation", "Follow-up", "New Client", "Existing Client" |
| `duration_presets` | Common durations users need | 15m, 30m, 45m, 1h, 1.5h, 2h |

#### 🟢 Post-Onboarding Configuration (Deferred to Settings)
| Field | Why Deferrable | Default |
|-------|---------------|---------|
| `working_hours` | Can use generous defaults | All days 6 AM - 8 PM |
| `require_confirmation` | Advanced feature | false |
| `use_booking_system` | Integration feature | false |
| `booking_url` | Optional integration | null |
| `address` | Already collected at signup | null |
| `default_opening_duration` | Can change per opening | 30 |
| Calendar integration | Complex OAuth setup | None |
| Staff management | Multi-provider feature | None |

---

## 4. Implemented Onboarding Flow

### Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIGNUP (existing)                           │
│  Phone → OTP → Business Name → Address (opt) → SMS Consent      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ONBOARDING WIZARD (implemented)               │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Step 1  │───▶│  Step 2  │───▶│  Step 3  │───▶│  Step 4  │  │
│  │ Welcome  │    │ Timezone │    │ Services │    │ Complete │  │
│  │ (~3 sec) │    │ (~10 sec)│    │ (~30 sec)│    │ (~5 sec) │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                 │
│  [Skip setup for now → Uses defaults, goes to Dashboard]        │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MERCHANT DASHBOARD                          │
│               (Openings page - Agenda view)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Breakdown

#### Step 1: Welcome (2-3 seconds)
**Purpose**: Orient the user and set expectations

**Implemented UI Elements**:
- OpenAlert logo (bell icon from `@/assets/notifyme-icon.png`)
- Headline: "Let's get you set up"
- Subhead: "Just 60 seconds and you're ready to go"
- 3 value cards with icons (Zap, Bell, DollarSign):
  - "Post last-minute openings" / "Fill cancellations fast"
  - "Customers get notified instantly" / "SMS alerts, no app needed"
  - "Fill empty slots, earn more" / "Turn cancellations into revenue"
- Primary CTA: "Get Started" button
- Secondary: "Skip setup for now" ghost button

**Technical**:
- No data collection
- `onContinue` → calls `nextStep()` which advances to step 2
- `onSkip` → calls `skipOnboarding()` which seeds defaults and completes

---

#### Step 2: Timezone (5-10 seconds)
**Purpose**: Ensure scheduling accuracy

**Implemented UI Elements**:
- Globe icon header
- Headline: "Confirm your timezone"
- Subhead: "Ensures appointments show correct times"
- Detected timezone displayed prominently (e.g., "Eastern Time (ET)")
- Clock emoji decoration
- Select dropdown to override with US timezone options
- Helper text: "You can change this later in Settings"
- Back button, Continue button

**Technical Implementation**:
- Auto-detect via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Falls back to `America/New_York` if detection fails or timezone not in list
- Persisted to `profiles.time_zone` via `saveTimezone()` when leaving step

**Timezone Options**:
```typescript
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];
```

---

#### Step 3: Services & Durations (20-30 seconds)
**Purpose**: Speed up future opening creation

**Implemented UI Elements**:
- Headline: "Set up your services"
- Subhead: "These will speed up creating openings. You can customize later."
- Two sections with icons (Tag, Clock):

**Appointment Types Section**:
- Pre-seeded chips (deletable, with X button on hover)
- Input field to add custom type
- Plus button to add
- Helper: Maximum 20 types limit

**Duration Presets Section**:
- Pre-seeded chips (deletable)
- Input field with smart parsing (accepts "30", "1h", "90m")
- Plus button to add
- Helper: Maximum 20 durations limit

**Tip Box**: "💡 Tip: These are just defaults. You can add custom values when creating openings."

- Back button, Continue button

**Technical Implementation**:
- Uses existing `useAppointmentPresets` and `useDurationPresets` hooks
- Defaults seeded on mount via `useEffect` if none exist
- When leaving step 3, `seedDefaultPresets()` ensures presets are saved
- Presets stored in `appointment_type_presets` and `duration_presets` tables

**Default Appointment Types**:
```typescript
const DEFAULT_APPOINTMENT_TYPES = [
  'Consultation',
  'Follow-up',
  'New Client',
  'Existing Client',
];
```

**Default Duration Presets**:
```typescript
const DEFAULT_DURATIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
];
```

---

#### Step 4: Complete (3-5 seconds)
**Purpose**: Celebrate and direct to action

**Implemented UI Elements**:
- Large green checkmark with decorative confetti dots (animated bounce)
- Headline: "You're all set! 🎉"
- Subhead: "Your account is ready. Start by posting your first opening."
- "What's next?" info card with Calendar icon explaining next steps
- Primary CTA: "Create First Opening" → opens modal with action=create
- Secondary CTA: "Go to Dashboard" ghost button

**Technical Implementation**:
- `onCreateOpening` → calls `completeOnboarding()` then navigates to `/merchant/openings?action=create`
- `onGoToDashboard` → calls `completeOnboarding()` which:
  - Sets `profiles.onboarding_completed_at = NOW()`
  - Sets `profiles.onboarding_step = 5`
  - Shows success toast
  - Navigates to `/merchant/openings`

---

### Edge Cases Handled

| Scenario | Implementation |
|----------|----------------|
| User refreshes during onboarding | Resume from last saved step via `onboarding_step` field |
| User clicks "Skip setup for now" | Seeds defaults, marks complete, navigates to dashboard |
| User navigates directly to `/merchant/onboarding` | Redirects to openings if `onboarding_completed_at` is set |
| Existing user (pre-migration) | Backfilled as `onboarding_completed_at = created_at`, skips onboarding |
| User not authenticated | Redirects to `/merchant/login` |

---

## 5. Data Model Changes

### New Profile Fields (Applied via Migration)

```sql
-- Migration: add_onboarding_fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Also added business fields with defaults
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS default_opening_duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS require_confirmation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS use_booking_system BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS booking_url TEXT,
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"monday":{"enabled":true,"start":"06:00","end":"20:00"},...}';

-- Backfill existing users as completed
UPDATE profiles 
SET onboarding_completed_at = created_at, 
    onboarding_step = 5
WHERE onboarding_completed_at IS NULL 
  AND created_at < NOW() - INTERVAL '1 minute';
```

### Onboarding State Machine

```
0 = Not started (new user, default)
1 = Welcome seen (saved when advancing from step 1)
2 = Timezone configured (saved when advancing from step 2)
3 = Services configured (saved when advancing from step 3)
4 = Complete screen seen (saved when advancing from step 4)
5 = Fully complete (set by completeOnboarding/skipOnboarding)
```

---

## 6. UI/UX Specifications

### Design System
- **Components**: shadcn/ui (Button, Card, Input, Select, Label)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React (Bell, Zap, DollarSign, Globe, Clock, Tag, ChevronLeft, ChevronRight, CheckCircle2, etc.)
- **Animations**: Tailwind animate-in utilities (fade-in, slide-in, zoom-in, bounce)

### Layout Structure

```
┌────────────────────────────────────────────────────────────┐
│              [Progress Dots - Steps 2-3 only]              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    [Step Content Area]                     │
│                    min-h-[420px]                           │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  [Back]                                        [Continue]  │
│  (Steps 2-4 only)                                          │
└────────────────────────────────────────────────────────────┘
```

### Responsive Behavior
- Mobile-first design
- Single column layout
- Centered Card on desktop (max-width: 480px via `max-w-md`)
- Touch-friendly buttons (full width on mobile)
- Padding: `p-6`, `px-2` for step content

### Accessibility
- ARIA labels on interactive elements
- Progress indicator with `role="progressbar"` and `aria-valuenow`
- Keyboard navigation (Tab through form elements)
- Screen reader-friendly button labels

### Animations Implemented
- Logo: `fade-in-0 zoom-in-95 duration-500`
- Headlines: `fade-in-0 slide-in-from-bottom-2 duration-500 delay-100`
- Value cards: `fade-in-0 slide-in-from-left-4 duration-500 delay-200/300/400`
- Actions: `fade-in-0 slide-in-from-bottom-4 duration-500 delay-500`
- Progress dots: `transition-all duration-300`
- Confetti dots on complete: `animate-bounce` with staggered delays

---

## 7. Technical Implementation

### Files Created

```
src/
├── pages/
│   └── merchant/
│       └── Onboarding.tsx           # Main onboarding page (route component)
├── components/
│   └── onboarding/
│       ├── OnboardingWizard.tsx     # Wizard container (step rendering)
│       ├── WelcomeStep.tsx          # Step 1 - value prop & start
│       ├── TimezoneStep.tsx         # Step 2 - timezone selection
│       ├── ServicesStep.tsx         # Step 3 - presets management
│       ├── CompleteStep.tsx         # Step 4 - success & CTA
│       └── OnboardingProgress.tsx   # Dot progress indicator
├── hooks/
│   └── useOnboarding.tsx            # State management, persistence, navigation
└── types/
    └── onboarding.ts                # Types, constants, defaults, timezone detection
```

### Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Added `/merchant/onboarding` route with ProtectedRoute |
| `src/pages/merchant/Login.tsx` | New merchants redirect to `/merchant/onboarding` instead of `/merchant/openings` |
| `src/integrations/supabase/types.ts` | Regenerated to include `onboarding_completed_at` and `onboarding_step` |

### Hook: useOnboarding

```typescript
interface UseOnboardingReturn {
  currentStep: OnboardingStep;           // 1 | 2 | 3 | 4
  timezone: string;                      // Current timezone value
  isLoading: boolean;                    // Loading state
  isComplete: boolean;                   // Whether onboarding is done
  needsOnboarding: boolean | null;       // null=checking, true=needs, false=done
  setTimezone: (tz: string) => void;     // Update timezone in state
  nextStep: () => Promise<void>;         // Advance to next step
  prevStep: () => void;                  // Go back one step
  skipOnboarding: () => Promise<void>;   // Skip with defaults
  completeOnboarding: () => Promise<void>; // Mark as complete
}
```

### Route Configuration

```typescript
// src/App.tsx
<Route 
  path="/merchant/onboarding" 
  element={
    <ProtectedRoute>
      <Onboarding />
    </ProtectedRoute>
  } 
/>
```

### Auth Flow Integration

```typescript
// src/pages/merchant/Login.tsx (after OTP verification)
navigate(isNewMerchant ? "/merchant/onboarding" : "/merchant/openings");
```

```typescript
// src/pages/merchant/Onboarding.tsx (redirect if complete)
useEffect(() => {
  if (!authLoading && !onboardingLoading && needsOnboarding === false) {
    navigate('/merchant/openings', { replace: true });
  }
}, [authLoading, onboardingLoading, needsOnboarding, navigate]);
```

---

## 8. Migration & Rollout

### Database Migration (Applied)
The migration was applied via Supabase MCP to the production database:
1. Added `onboarding_completed_at` and `onboarding_step` columns
2. Added business configuration columns with defaults
3. Backfilled existing users as onboarding-complete

### Rollout Strategy (Completed)
1. ✅ **Phase 1**: Database migration deployed
2. ✅ **Phase 2**: Onboarding UI deployed to production
3. ✅ **Phase 3**: Login redirect updated for new signups
4. ✅ **Phase 4**: Existing users bypass onboarding (backfilled)

---

## 9. Future Considerations

### V1.1 Enhancements (Not Implemented)
- Industry-specific preset suggestions (salon, medical, fitness)
- Working hours quick setup step
- Import from other booking apps
- Onboarding analytics tracking

### V2.0 Ideas (Not Implemented)
- Onboarding video walkthrough
- In-app product tour post-onboarding
- Gamification (achievement badges)
- Referral prompt at completion
- A/B test different onboarding flows

---

## 10. Appendix

### A. Timezone Detection Logic

```typescript
// src/types/onboarding.ts
export function detectBrowserTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check if detected timezone is in our supported list
    const match = TIMEZONE_OPTIONS.find(tz => tz.value === detected);
    return match ? detected : 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}
```

### B. Duration Input Parsing

```typescript
// src/components/onboarding/ServicesStep.tsx
const parseDurationInput = (input: string): { label: string; minutes: number } | null => {
  const cleaned = input.toLowerCase().trim();
  
  // Pure number (assumed minutes): "30" → { label: "30m", minutes: 30 }
  if (/^\d+$/.test(cleaned)) {
    const minutes = parseInt(cleaned);
    const label = minutes < 60 ? `${minutes}m` : minutes === 60 ? '1h' : `${(minutes / 60).toFixed(1)}h`;
    return { label, minutes };
  }
  
  // Hour format: "1.5h" → { label: "1.5h", minutes: 90 }
  const hourMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*h/);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    return { label: `${hours}h`, minutes: Math.round(hours * 60) };
  }
  
  // Minute format: "90m" → { label: "90m", minutes: 90 }
  const minuteMatch = cleaned.match(/^(\d+)\s*m/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1]);
    return { label: `${minutes}m`, minutes };
  }
  
  return null;
};
```

### C. Complete UI Copy Reference

| Element | Copy |
|---------|------|
| Welcome headline | "Let's get you set up" |
| Welcome subhead | "Just 60 seconds and you're ready to go" |
| Value prop 1 title | "Post last-minute openings" |
| Value prop 1 subtitle | "Fill cancellations fast" |
| Value prop 2 title | "Customers get notified instantly" |
| Value prop 2 subtitle | "SMS alerts, no app needed" |
| Value prop 3 title | "Fill empty slots, earn more" |
| Value prop 3 subtitle | "Turn cancellations into revenue" |
| Get started button | "Get Started" |
| Skip button | "Skip setup for now" |
| Timezone headline | "Confirm your timezone" |
| Timezone subhead | "Ensures appointments show correct times" |
| Timezone helper | "You can change this later in Settings" |
| Services headline | "Set up your services" |
| Services subhead | "These will speed up creating openings. You can customize later." |
| Services tip | "💡 Tip: These are just defaults. You can add custom values when creating openings." |
| Complete headline | "You're all set! 🎉" |
| Complete subhead | "Your account is ready. Start by posting your first opening." |
| Complete next title | "What's next?" |
| Complete next body | "Post an opening when you have a cancellation or free slot. Customers will get notified instantly." |
| Create opening button | "Create First Opening" |
| Go to dashboard button | "Go to Dashboard" |
| Back button | "Back" |
| Continue button | "Continue" |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-11-26 | Initial draft |
| 1.1 | 2024-11-26 | Corrected schema (removed non-existent fields), removed SkipOnboardingDialog reference, added implementation details, marked as Implemented |
