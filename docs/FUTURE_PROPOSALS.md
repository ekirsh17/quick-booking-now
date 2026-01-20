# OpenAlert: Future Proposals & Gaps

## Overview

This document outlines technical gaps, missing features, and improvement opportunities identified during E2E testing. Items are prioritized by impact and effort.

---

## 🔴 Critical Gaps (High Priority)

### 1. Subscription Billing Flow
**Status:** Not Implemented  
**Impact:** Revenue-blocking  
**Description:** The "Manage Billing" button exists in settings but there's no actual billing integration.

**Recommendation:**
- Integrate Stripe for subscription management
- Implement usage-based billing tiers
- Add billing portal for plan changes/cancellations
- Handle trial periods and grace periods

### 2. SMS Delivery Verification
**Status:** Partial  
**Impact:** Core functionality reliability  
**Description:** No robust mechanism to verify SMS actually delivered to consumers.

**Recommendation:**
- Implement Twilio delivery status webhooks
- Add retry logic for failed messages
- Create notification delivery dashboard
- Alert merchants on repeated failures

### 3. Calendar Sync Reliability
**Status:** Basic Implementation  
**Impact:** User trust  
**Description:** Google Calendar integration exists but lacks error recovery.

**Recommendation:**
- Add sync status indicators
- Implement conflict resolution
- Auto-retry failed syncs
- Support two-way sync (calendar → app)

---

## 🟡 Important Gaps (Medium Priority)

### 4. Consumer Account Management
**Status:** Minimal  
**Impact:** User experience  
**Description:** Consumers can sign in but have limited account management.

**Recommendation:**
- Notification preferences (frequency, quiet hours)
- Favorite merchants list
- Booking history with receipts
- One-click re-booking

### 5. Merchant Analytics Depth
**Status:** Basic metrics only  
**Impact:** Business value  
**Description:** Current analytics show basic counts but lack actionable insights.

**Recommendation:**
- Revenue attribution tracking
- Peak hours analysis
- Customer lifetime value
- Conversion funnel visualization
- Export to CSV/PDF

### 6. Multi-Location Support
**Status:** Not Implemented  
**Impact:** Enterprise scalability  
**Description:** Merchants with multiple locations must create separate accounts.

**Recommendation:**
- Organization-level accounts
- Location management dashboard
- Cross-location analytics
- Staff permissions per location

### 7. Email Notifications
**Status:** Not Implemented  
**Impact:** User reach  
**Description:** All notifications are SMS-only.

**Recommendation:**
- Email as secondary channel
- Email preference settings
- Email templates for confirmations
- Digest emails for merchants

---

## 🟢 Nice-to-Have (Lower Priority)

### 8. Push Notifications
**Status:** Not Implemented  
**Description:** Web push for real-time updates without SMS costs.

### 9. Waitlist Management
**Status:** Not Implemented  
**Description:** Allow consumers to join waitlists for specific time slots.

### 10. Recurring Openings
**Status:** Not Implemented  
**Description:** Merchants must manually create each opening; no recurring patterns.

### 11. Service Categories
**Status:** Basic  
**Description:** Appointment types exist but no category hierarchy.

### 12. Staff/Provider Assignment
**Status:** Not Implemented  
**Description:** No way to assign specific staff to openings.

### 13. Customer Notes/History
**Status:** Not Implemented  
**Description:** Merchants can't see past interactions with specific consumers.

### 14. Internationalization (i18n)
**Status:** Not Implemented  
**Description:** All text is hardcoded in English.

### 15. Dark Mode
**Status:** Not Implemented  
**Description:** Theme switching exists but dark mode styles incomplete.

---

## Technical Debt

### 1. ESLint Warnings
**Count:** ~15 warnings remaining  
**Files:** Mostly in `ui/` components (shadcn defaults)  
**Action:** Low priority, these are React Refresh warnings for exported constants

### 2. Missing Error Boundaries
**Status:** Partial  
**Description:** Some pages lack error boundaries for graceful failure handling.

### 3. Loading State Consistency
**Status:** Inconsistent  
**Description:** Different components use different loading patterns (spinners, skeletons, none).

### 4. API Error Handling
**Status:** Basic  
**Description:** Most API errors show generic messages; could be more user-friendly.

### 5. Test Data Isolation
**Status:** Shared test data  
**Description:** E2E tests use production-like data; should use isolated test fixtures.

---

## Security Considerations

### 1. Rate Limiting
**Status:** Unknown  
**Description:** OTP requests should be rate-limited to prevent abuse.

### 2. Session Management
**Status:** Basic (Supabase defaults)  
**Description:** Consider implementing session timeout and concurrent session limits.

### 3. Audit Logging
**Status:** Not Implemented  
**Description:** No audit trail for sensitive operations (account deletion, settings changes).

---

## Performance Opportunities

### 1. Image Optimization
**Status:** Not optimized  
**Description:** No lazy loading or responsive images.

### 2. Bundle Size
**Status:** Not analyzed  
**Description:** Consider code splitting for merchant vs consumer routes.

### 3. Caching Strategy
**Status:** Basic  
**Description:** React Query caching in place but could be more aggressive.

---

## Recommended Roadmap

### Phase 1: Revenue Enablement (1-2 weeks)
1. Stripe billing integration
2. Subscription management UI
3. Usage tracking

### Phase 2: Reliability (1-2 weeks)
1. SMS delivery webhooks
2. Calendar sync improvements
3. Error boundary coverage

### Phase 3: User Experience (2-3 weeks)
1. Consumer notification preferences
2. Enhanced analytics
3. Email notifications

### Phase 4: Scale (3-4 weeks)
1. Multi-location support
2. Staff management
3. Recurring openings

---

## Summary

**Total Gaps Identified:** 15 features + 5 technical debt items + 3 security items + 3 performance items

**Most Critical:**
1. ⚠️ Billing flow (revenue-blocking)
2. ⚠️ SMS delivery verification (reliability)
3. ⚠️ Calendar sync reliability (user trust)

**Quick Wins:**
1. Email notifications (high impact, medium effort)
2. Recurring openings (high merchant value)
3. Loading state consistency (polish)









