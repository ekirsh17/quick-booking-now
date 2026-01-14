# NotifyMe Security Improvement Plan

**Date**: November 26, 2025  
**Based on**: [SECURITY_REVIEW.md](./SECURITY_REVIEW.md)

---

## Overview

This document provides a prioritized roadmap to address the security findings from the NotifyMe security review. Tasks are organized into three phases based on severity and risk.

---

## Phase 1: Critical & High Priority (Week 1-2)

These issues pose immediate security risks and should be addressed before any production deployment.

### 1.1 Enable RLS on All Tables (SEC-001)
**Effort**: Medium (M)  
**Risk of Change**: Medium - Could break existing queries if policies are too restrictive  
**Finding**: SEC-001

**Tasks**:
- [ ] Create migration to enable RLS on all 11 tables
- [ ] Add service_role-only policies for sensitive tables:
  - `otp_codes` - service role only
  - `external_calendar_accounts` - merchant-scoped + service role
  - `oauth_transactions` - merchant-scoped + service role
  - `inbound_numbers` - service role only
- [ ] Add merchant-scoped policies for:
  - `staff` - merchant can manage own staff
  - `external_calendar_events` - merchant-scoped
  - `external_calendar_links` - merchant-scoped
- [ ] Add appropriate policies for:
  - `user_roles` - authenticated read own
  - `qr_codes` - merchant-scoped
  - `qr_code_scans` - merchant-scoped
  - `notification_idempotency` - service role only
- [ ] Test all affected queries after migration

**SQL Template**:
```sql
-- Example for otp_codes
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage OTP codes"
  ON public.otp_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

### 1.2 Remove Testing Backdoors (SEC-007, SEC-008)
**Effort**: Small (S)  
**Risk of Change**: Low - Only affects test flows  
**Finding**: SEC-007, SEC-008

**Tasks**:
- [ ] Remove `TEST_CODE` backdoor from `verify-otp/index.ts`
- [ ] Add CI check to fail if `TESTING_MODE=true` in production env
- [ ] Remove `SKIP_TWILIO_SIGNATURE_VALIDATION` flag entirely
- [ ] Use Twilio test credentials for development instead

**Code Change** (`verify-otp/index.ts`):
```typescript
// REMOVE THIS BLOCK ENTIRELY:
// const TESTING_MODE = Deno.env.get('TESTING_MODE') === 'true';
// const TEST_CODE = '999999';
// if (TESTING_MODE && code === TEST_CODE) { ... }
```

---

### 1.3 Add Twilio Signature Validation to SMS Reply Handler (SEC-009)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-009

**Tasks**:
- [ ] Import `validateTwilioSignature` from `shared/twilioValidation.ts`
- [ ] Add signature validation at start of handler
- [ ] Return 403 for invalid signatures

**Code Change** (`handle-sms-reply/index.ts`):
```typescript
import { validateTwilioSignature, parseTwilioFormData, getWebhookUrl } from '../shared/twilioValidation.ts';

const handler = async (req: Request): Promise<Response> => {
  // ... existing OPTIONS handling ...

  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!TWILIO_AUTH_TOKEN) {
    return new Response('Server configuration error', { status: 500 });
  }

  const params = await parseTwilioFormData(req);
  const signature = req.headers.get('X-Twilio-Signature') || '';
  const webhookUrl = getWebhookUrl(req);
  
  const isValid = await validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, webhookUrl, params);
  if (!isValid) {
    console.warn('[handle-sms-reply] Invalid Twilio signature');
    return new Response('Invalid signature', { status: 403 });
  }

  // ... rest of handler ...
};
```

---

### 1.4 Disable Admin Panel in Production (SEC-011, SEC-012)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-011, SEC-012

**Tasks**:
- [ ] Change default `isAdminMode` to `false`
- [ ] Add environment check to conditionally render admin panel
- [ ] Remove hardcoded test phone number
- [ ] Consider excluding admin components from production build

**Code Change** (`AdminContext.tsx`):
```typescript
const [isAdminMode, setIsAdminMode] = useState(
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true'
);
```

---

### 1.5 Add Notifications Table RLS Policies (SEC-002)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-002

**Tasks**:
- [ ] Add merchant-scoped SELECT policy
- [ ] Add service role INSERT/UPDATE policy

```sql
CREATE POLICY "Merchants can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Service role can manage notifications"
  ON public.notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

### 1.6 Review Security Definer View (SEC-003)
**Effort**: Small (S)  
**Risk of Change**: Medium - May affect consumer booking flow  
**Finding**: SEC-003

**Tasks**:
- [ ] Audit `public_open_slots` view definition
- [ ] Verify it doesn't expose cross-merchant data
- [ ] Consider changing to `SECURITY INVOKER` if appropriate

---

### 1.7 Encrypt OAuth Tokens at Rest (SEC-023)
**Effort**: Medium (M)  
**Risk of Change**: Medium - Requires migration of existing tokens  
**Finding**: SEC-023

**Tasks**:
- [ ] Implement encryption/decryption functions using `encrypted_credentials` column
- [ ] Create migration to encrypt existing tokens
- [ ] Update Edge Functions to decrypt tokens before use
- [ ] Consider using Supabase Vault for key management

---

## Phase 2: Medium Priority (Week 3-4)

These issues should be addressed to harden the application before scaling.

### 2.1 Implement Rate Limiting (SEC-016)
**Effort**: Medium (M)  
**Risk of Change**: Low  
**Finding**: SEC-016

**Tasks**:
- [ ] Add rate limiting to `generate-otp` (5 requests/phone/hour)
- [ ] Add rate limiting to `verify-otp` (10 attempts/phone/hour)
- [ ] Add rate limiting to `send-sms` (100 messages/merchant/day)
- [ ] Consider using Supabase rate limiting or edge middleware

**Options**:
1. Use Supabase Edge Function rate limiting (if available)
2. Implement token bucket in database
3. Use external rate limiting service (Upstash, etc.)

---

### 2.2 Restrict CORS Origins (SEC-019)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-019

**Tasks**:
- [ ] Create `ALLOWED_ORIGINS` environment variable
- [ ] Update all Edge Functions to check origin
- [ ] Allow `*` only in development

**Code Template**:
```typescript
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];
const origin = req.headers.get('origin') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0],
  // ...
};
```

---

### 2.3 Tighten Consumer/Profile RLS Policies (SEC-005, SEC-006)
**Effort**: Medium (M)  
**Risk of Change**: Medium - May affect consumer flows  
**Finding**: SEC-005, SEC-006

**Tasks**:
- [ ] Restrict consumer SELECT to authenticated users or merchant context
- [ ] Restrict profile SELECT to authenticated users
- [ ] Create public-facing view with limited fields if needed

---

### 2.4 Fix Function search_path (SEC-004)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-004

**Tasks**:
- [ ] Create migration to set search_path on all 8 functions

```sql
ALTER FUNCTION public.normalize_e164 SET search_path = public;
ALTER FUNCTION public.profiles_phone_normalize SET search_path = public;
-- ... repeat for all 8 functions
```

---

### 2.5 Enable Leaked Password Protection (SEC-018)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-018

**Tasks**:
- [ ] Enable in Supabase Dashboard > Auth > Settings > Password Protection
- [ ] Test that weak/leaked passwords are rejected

---

### 2.6 Implement Node Server Webhook or Remove (SEC-015)
**Effort**: Medium (M)  
**Risk of Change**: Low  
**Finding**: SEC-015

**Tasks**:
- [ ] Either implement full Twilio signature validation
- [ ] Or remove the stub endpoint if not needed

---

### 2.7 Fix OTP Attempt Race Condition (SEC-017)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-017

**Tasks**:
- [ ] Use atomic increment with check:
```sql
UPDATE otp_codes 
SET attempts = attempts + 1 
WHERE id = $1 AND attempts < 3
RETURNING *;
```

---

## Phase 3: Low Priority & Hardening (Week 5+)

These are best practices that improve overall security posture.

### 3.1 Improve CI/CD Security (SEC-020, SEC-021, SEC-022)
**Effort**: Small (S)  
**Risk of Change**: Low  
**Finding**: SEC-020, SEC-021, SEC-022

**Tasks**:
- [ ] Remove `continue-on-error` from lint/typecheck once codebase is clean
- [ ] Add Dependabot configuration:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
```
- [ ] Add `npm audit` to CI pipeline
- [ ] Verify branch protection rules on `main`

---

### 3.2 Consider HttpOnly Cookie Sessions (SEC-010)
**Effort**: Large (L)  
**Risk of Change**: High - Significant auth refactor  
**Finding**: SEC-010

**Tasks**:
- [ ] Evaluate Supabase SSR package for cookie-based auth
- [ ] Implement CSRF protection if using cookies
- [ ] Update all auth flows

**Note**: This is a larger architectural change. Ensure robust CSP and XSS protections as an alternative.

---

### 3.3 Add Content Security Policy (Best Practice)
**Effort**: Medium (M)  
**Risk of Change**: Medium - May break inline scripts  

**Tasks**:
- [ ] Add CSP headers via Vite plugin or hosting config
- [ ] Start with report-only mode
- [ ] Tighten policy iteratively

---

### 3.4 Implement Audit Logging (Best Practice)
**Effort**: Large (L)  
**Risk of Change**: Low  

**Tasks**:
- [ ] Log security-relevant events (login, OTP verify, booking changes)
- [ ] Store in separate audit table
- [ ] Consider Supabase Realtime for alerting

---

### 3.5 Secret Rotation Strategy (Best Practice)
**Effort**: Medium (M)  
**Risk of Change**: Low  

**Tasks**:
- [ ] Document all secrets and their rotation schedule
- [ ] Implement key rotation for:
  - `SLOT_LINK_SIGNING_SECRET`
  - Twilio credentials
  - OAuth client secrets
- [ ] Use Supabase Vault or external secret manager

---

## Implementation Checklist

### Phase 1 (Critical) - Target: 2 weeks
| Task | Owner | Status | PR |
|------|-------|--------|-----|
| 1.1 Enable RLS on all tables | | [ ] | |
| 1.2 Remove testing backdoors | | [ ] | |
| 1.3 Add Twilio validation to SMS reply | | [ ] | |
| 1.4 Disable admin panel in production | | [ ] | |
| 1.5 Add notifications RLS policies | | [ ] | |
| 1.6 Review security definer view | | [ ] | |
| 1.7 Encrypt OAuth tokens | | [ ] | |

### Phase 2 (Medium) - Target: 4 weeks
| Task | Owner | Status | PR |
|------|-------|--------|-----|
| 2.1 Implement rate limiting | | [ ] | |
| 2.2 Restrict CORS origins | | [ ] | |
| 2.3 Tighten consumer/profile RLS | | [ ] | |
| 2.4 Fix function search_path | | [ ] | |
| 2.5 Enable leaked password protection | | [ ] | |
| 2.6 Implement/remove Node webhook | | [ ] | |
| 2.7 Fix OTP race condition | | [ ] | |

### Phase 3 (Low/Hardening) - Target: 6+ weeks
| Task | Owner | Status | PR |
|------|-------|--------|-----|
| 3.1 Improve CI/CD security | | [ ] | |
| 3.2 Consider HttpOnly cookies | | [ ] | |
| 3.3 Add CSP headers | | [ ] | |
| 3.4 Implement audit logging | | [ ] | |
| 3.5 Secret rotation strategy | | [ ] | |

---

## Mapping: Findings → Tasks

| Finding ID | Task(s) |
|------------|---------|
| SEC-001 | 1.1 |
| SEC-002 | 1.5 |
| SEC-003 | 1.6 |
| SEC-004 | 2.4 |
| SEC-005 | 2.3 |
| SEC-006 | 2.3 |
| SEC-007 | 1.2 |
| SEC-008 | 1.2 |
| SEC-009 | 1.3 |
| SEC-010 | 3.2 |
| SEC-011 | 1.4 |
| SEC-012 | 1.4 |
| SEC-013 | N/A (Low risk) |
| SEC-015 | 2.6 |
| SEC-016 | 2.1 |
| SEC-017 | 2.7 |
| SEC-018 | 2.5 |
| SEC-019 | 2.2 |
| SEC-020 | 3.1 |
| SEC-021 | 3.1 |
| SEC-022 | 3.1 |
| SEC-023 | 1.7 |

---

## Next Steps

1. **Review this plan** with the engineering team
2. **Answer the clarifying questions** in the Security Review document
3. **Prioritize Phase 1** tasks for immediate implementation
4. **Create GitHub issues** for each task with appropriate labels
5. **Schedule a penetration test** after Phase 1 completion

---

*This plan should be reviewed and updated as findings are addressed and new requirements emerge.*









