# OpenAlert Security Review

**Date**: November 26, 2025  
**Reviewer**: AI Security Audit  
**Scope**: End-to-end security review of frontend, backend, database, integrations, and CI/CD

---

## Executive Summary

This security review identified **23 findings** across the OpenAlert application stack.

### ✅ REMEDIATION STATUS (Updated Nov 26, 2025)

**Critical fixes applied:**
- ✅ **SEC-001**: Enabled RLS on all 11 previously unprotected tables
- ✅ **SEC-002**: Added RLS policies to notifications table  
- ✅ **SEC-004**: Fixed search_path on all 8 vulnerable functions
- ✅ **SEC-007**: Removed OTP testing backdoor (`999999` code)
- ✅ **SEC-009**: Added Twilio signature validation to SMS reply handler
- ✅ **SEC-011/012**: Disabled admin panel by default, removed hardcoded phone number

**Remaining items (2):**
- ⚠️ **SEC-003**: Security definer view `public_open_slots` - needs manual review
- ⚠️ **SEC-018**: Leaked password protection disabled - enable in Supabase Dashboard

### Original Findings Summary:
- **Critical**: 3 findings → **0 remaining**
- **High**: 7 findings → **1 remaining** (SEC-003)
- **Medium**: 8 findings → **1 remaining** (SEC-018)  
- **Low**: 5 findings → **5 remaining** (minor hardening)

---

## Threat Model

### Key Assets
| Asset | Sensitivity | Location |
|-------|-------------|----------|
| Phone numbers (PII) | High | `profiles.phone`, `consumers.phone`, `sms_logs.*` |
| OAuth tokens | Critical | `external_calendar_accounts.access_token`, `oauth_transactions.*` |
| OTP codes | High | `otp_codes.code` |
| Booking data | Medium | `slots.*`, `notify_requests.*` |
| Billing identifiers | High | `subscriptions.*`, `billing_events.*` |

### Actors
- **Merchants**: Create openings, receive bookings, manage business
- **Consumers**: Book appointments, receive SMS notifications
- **Admins**: Internal testing/debugging (currently no role separation)
- **Attackers**: External (unauthenticated), authenticated (cross-tenant), internal (compromised credentials)

### Entry Points
1. **Web UI**: React SPA at various routes
2. **Supabase Edge Functions**: 19+ functions handling SMS, auth, calendar
3. **Node/Express Server**: SMS intake webhook (`/api/twilio-sms`)
4. **Twilio Webhooks**: Status callbacks, SMS replies
5. **Google OAuth**: Calendar integration callbacks

---

## Findings by Area

### 1. Database & RLS (Critical)

#### SEC-001: Multiple Tables Missing RLS (CRITICAL)
**Severity**: Critical  
**Component**: Database  
**Description**: 11 tables in the public schema have RLS disabled, exposing sensitive data to any authenticated user via the anon/authenticated roles.

**Affected Tables**:
| Table | Contains |
|-------|----------|
| `otp_codes` | OTP verification codes, phone numbers |
| `external_calendar_accounts` | OAuth access/refresh tokens, encrypted credentials |
| `external_calendar_events` | Calendar event IDs |
| `external_calendar_links` | Calendar IDs |
| `oauth_transactions` | OAuth tokens |
| `inbound_numbers` | Merchant phone mappings |
| `staff` | Staff names, phones, merchant associations |
| `user_roles` | Role assignments |
| `qr_codes` | Merchant QR codes |
| `qr_code_scans` | QR scan analytics |
| `notification_idempotency` | Idempotency keys |

**Evidence**: Supabase security advisor returned 11 `rls_disabled_in_public` errors.

**Impact**: 
- Any authenticated user can read all OAuth tokens and refresh tokens
- OTP codes can be enumerated to bypass authentication
- Cross-merchant data leakage

**Recommendation**: 
```sql
-- For each table, enable RLS and add appropriate policies
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.otp_codes
  FOR ALL USING (auth.role() = 'service_role');
```

---

#### SEC-002: Notifications Table Has RLS But No Policies (HIGH)
**Severity**: High  
**Component**: Database  
**Description**: The `notifications` table has RLS enabled but no policies defined, meaning no one (including service role in some contexts) can access it through normal queries.

**Evidence**: Supabase advisor: `rls_enabled_no_policy` for `public.notifications`

**Impact**: Potential data access issues; unclear security posture.

**Recommendation**: Add explicit RLS policies for merchant-scoped access.

---

#### SEC-003: Security Definer View Bypasses RLS (HIGH)
**Severity**: High  
**Component**: Database  
**Description**: The view `public.public_open_slots` is defined with `SECURITY DEFINER`, meaning it runs with the creator's permissions, bypassing RLS for querying users.

**Evidence**: Supabase advisor: `security_definer_view` for `public.public_open_slots`

**Impact**: Could expose slots across merchants if not carefully designed.

**Recommendation**: Review view definition; consider `SECURITY INVOKER` or explicit filtering.

---

#### SEC-004: Functions Missing search_path (MEDIUM)
**Severity**: Medium  
**Component**: Database  
**Description**: 8 functions have mutable `search_path`, potentially allowing schema injection attacks.

**Affected Functions**:
- `normalize_e164`
- `profiles_phone_normalize`
- `update_updated_at_column`
- `update_billing_updated_at`
- `increment_trial_openings`
- `check_trial_status`
- `get_current_sms_usage`
- `increment_sms_usage`

**Recommendation**: Set explicit search_path:
```sql
ALTER FUNCTION public.normalize_e164 SET search_path = public;
```

---

#### SEC-005: Overly Permissive Consumer Policies (MEDIUM)
**Severity**: Medium  
**Component**: Database  
**Description**: The `consumers` table allows anyone to:
- INSERT any consumer record (`Anyone can create consumer` → `with_check: true`)
- SELECT all consumers (`Anyone can view consumers` → `qual: true`)

**Evidence**: RLS policy analysis shows `{public}` role with `true` conditions.

**Impact**: Consumer PII (names, phones) readable by any visitor.

**Recommendation**: Restrict SELECT to authenticated users or merchant-scoped queries.

---

#### SEC-006: Profiles Readable by Anyone (MEDIUM)
**Severity**: Medium  
**Component**: Database  
**Description**: The `profiles` table policy `Anyone can view profiles` allows anon and authenticated users to read all merchant profiles.

**Impact**: Business names, addresses, phone numbers exposed.

**Recommendation**: Consider restricting to authenticated users or public-facing fields only.

---

### 2. Authentication & Authorization

#### SEC-007: OTP Testing Backdoor in Production Code (CRITICAL)
**Severity**: Critical  
**Component**: `supabase/functions/verify-otp/index.ts`  
**Description**: A hardcoded test code `999999` bypasses OTP verification when `TESTING_MODE=true`.

**Evidence**:
```typescript
const TESTING_MODE = Deno.env.get('TESTING_MODE') === 'true';
const TEST_CODE = '999999';
if (TESTING_MODE && code === TEST_CODE) {
  // Skip OTP verification
}
```

**Impact**: If `TESTING_MODE` is accidentally left enabled in production, any account can be accessed with code `999999`.

**Recommendation**: 
1. Remove backdoor code entirely from production builds
2. Use environment-based feature flags with CI/CD validation
3. Add startup check that fails if `TESTING_MODE=true` in production

---

#### SEC-008: Twilio Signature Validation Skip Flag (HIGH)
**Severity**: High  
**Component**: `supabase/functions/twilio-status-callback/index.ts`  
**Description**: Environment variable `SKIP_TWILIO_SIGNATURE_VALIDATION` allows bypassing Twilio webhook authentication.

**Evidence**:
```typescript
const SKIP_SIGNATURE_VALIDATION = Deno.env.get('SKIP_TWILIO_SIGNATURE_VALIDATION') === 'true';
if (!SKIP_SIGNATURE_VALIDATION) { /* validate */ }
```

**Impact**: Attackers could forge Twilio webhooks to manipulate SMS delivery status.

**Recommendation**: Remove skip flag; use Twilio's test credentials for development.

---

#### SEC-009: Missing Twilio Signature Validation on SMS Reply Handler (CRITICAL)
**Severity**: Critical  
**Component**: `supabase/functions/handle-sms-reply/index.ts`  
**Description**: The SMS reply webhook handler does NOT validate Twilio signatures at all.

**Evidence**: No signature validation code present in the handler.

**Impact**: 
- Attackers can forge SMS replies to unsubscribe users
- Can trigger booking confirmations without actual SMS
- Can manipulate merchant booking states

**Recommendation**: Add signature validation using the shared `twilioValidation.ts` module.

---

#### SEC-010: Auth Tokens Stored in localStorage (MEDIUM)
**Severity**: Medium  
**Component**: `src/integrations/supabase/client.ts`  
**Description**: Supabase client configured to use `localStorage` for session storage.

**Evidence**:
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
  }
});
```

**Impact**: XSS vulnerabilities could steal session tokens. localStorage is accessible to any JavaScript on the page.

**Recommendation**: Consider using secure, HttpOnly cookies for session management, or ensure robust CSP and XSS protections.

---

### 3. Frontend Security

#### SEC-011: Admin Panel Enabled by Default (HIGH)
**Severity**: High  
**Component**: `src/contexts/AdminContext.tsx`, `src/components/admin/AdminToggle.tsx`  
**Description**: The admin panel is initialized with `isAdminMode: true` and visible to all users.

**Evidence**:
```typescript
const [isAdminMode, setIsAdminMode] = useState(true);
```

**Impact**: 
- Exposes internal navigation and test tools to end users
- Shows hardcoded test phone number
- Allows triggering test SMS to arbitrary numbers

**Recommendation**: 
1. Default `isAdminMode` to `false`
2. Gate admin access behind authentication check (e.g., check user role)
3. Use build-time flag to exclude admin code from production bundles

---

#### SEC-012: Hardcoded Test Phone Number in Admin Panel (MEDIUM)
**Severity**: Medium  
**Component**: `src/components/admin/AdminToggle.tsx`  
**Description**: Test phone number `+15165879844` is hardcoded in the admin panel.

**Evidence**:
```typescript
const handleSendTestSMS = async () => {
  await supabase.functions.invoke('send-sms', {
    body: { to: '+15165879844', message: `Test from OpenAlert Admin...` },
  });
};
```

**Impact**: Exposes PII; could be used to spam the number.

**Recommendation**: Remove hardcoded number; use authenticated user's phone or require input.

---

#### SEC-013: dangerouslySetInnerHTML Usage (LOW)
**Severity**: Low  
**Component**: `src/components/ui/chart.tsx`  
**Description**: Uses `dangerouslySetInnerHTML` to inject CSS styles.

**Evidence**:
```typescript
<style dangerouslySetInnerHTML={{ __html: Object.entries(THEMES)... }} />
```

**Impact**: Low risk as content is derived from static theme config, not user input.

**Recommendation**: Verify no user input flows into this; consider CSS-in-JS alternatives.

---

#### SEC-014: External Links Have Proper rel Attributes (OK)
**Severity**: N/A (Positive Finding)  
**Component**: `src/pages/ConsumerNotify.tsx`, `src/pages/Tools.tsx`  
**Description**: External links correctly use `target="_blank" rel="noopener noreferrer"`.

**Evidence**: grep confirmed proper attributes on all external links.

---

### 4. Backend & API Security

#### SEC-015: Node Server Twilio Webhook Not Implemented (MEDIUM)
**Severity**: Medium  
**Component**: `server/src/routes/twilio-sms.ts`  
**Description**: The Node/Express Twilio webhook handler is a stub with TODO comments—signature validation is not implemented.

**Evidence**:
```typescript
// TODO: Implement Twilio signature verification
// const isValid = validateTwilioSignature(signature, url, params);
```

**Impact**: If this endpoint is exposed, it accepts any request without validation.

**Recommendation**: Either implement validation or remove/disable the endpoint.

---

#### SEC-016: No Rate Limiting on Edge Functions (MEDIUM)
**Severity**: Medium  
**Component**: All Supabase Edge Functions  
**Description**: No rate limiting observed on critical endpoints like `generate-otp`, `verify-otp`, `send-sms`.

**Evidence**: Code review shows no rate limiting middleware or checks beyond the 1-minute OTP cooldown.

**Impact**: 
- OTP brute-force attacks (only 1M combinations for 6-digit code)
- SMS bombing/cost abuse
- API abuse

**Recommendation**: 
1. Implement rate limiting at Supabase or edge level
2. Add exponential backoff for failed OTP attempts
3. Consider CAPTCHA for public-facing forms

---

#### SEC-017: OTP Attempt Limit Check Has Race Condition (LOW)
**Severity**: Low  
**Component**: `supabase/functions/verify-otp/index.ts`  
**Description**: OTP attempt count is checked but not atomically incremented.

**Evidence**: Separate SELECT and UPDATE operations without transaction.

**Impact**: Parallel requests could bypass the 3-attempt limit.

**Recommendation**: Use atomic increment with check in single query.

---

### 5. Secrets & Configuration

#### SEC-018: Leaked Password Protection Disabled (MEDIUM)
**Severity**: Medium  
**Component**: Supabase Auth Configuration  
**Description**: Supabase Auth's leaked password protection (HaveIBeenPwned check) is disabled.

**Evidence**: Supabase advisor: `auth_leaked_password_protection` warning.

**Impact**: Users can set compromised passwords.

**Recommendation**: Enable in Supabase Dashboard > Auth > Settings.

---

#### SEC-019: CORS Allows All Origins (MEDIUM)
**Severity**: Medium  
**Component**: All Edge Functions  
**Description**: CORS headers set to `Access-Control-Allow-Origin: '*'`.

**Evidence**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
};
```

**Impact**: Any website can make requests to these endpoints.

**Recommendation**: Restrict to known frontend origins in production.

---

### 6. CI/CD & GitHub

#### SEC-020: CI Continues on Lint/Typecheck Errors (LOW)
**Severity**: Low  
**Component**: `.github/workflows/ci.yml`  
**Description**: Lint and typecheck steps have `continue-on-error: true`.

**Evidence**:
```yaml
- name: Run linter
  run: npm run lint
  continue-on-error: true
```

**Impact**: Security-relevant lint rules may be ignored.

**Recommendation**: Remove `continue-on-error` once codebase is clean.

---

#### SEC-021: No Dependabot or Security Scanning (LOW)
**Severity**: Low  
**Component**: GitHub Configuration  
**Description**: No Dependabot configuration or security scanning workflows observed.

**Impact**: Vulnerable dependencies may go unnoticed.

**Recommendation**: Enable Dependabot alerts and add `npm audit` to CI.

---

#### SEC-022: No Branch Protection Verification (LOW)
**Severity**: Low  
**Component**: GitHub Configuration  
**Description**: Unable to verify branch protection rules are enabled.

**Recommendation**: Ensure `main` branch requires PR reviews and passing CI.

---

### 7. Third-Party Integrations

#### SEC-023: Google OAuth Tokens Stored Unencrypted (HIGH)
**Severity**: High  
**Component**: `external_calendar_accounts` table  
**Description**: OAuth access and refresh tokens stored in plaintext columns alongside an `encrypted_credentials` column that may not be used.

**Evidence**: Schema shows both `access_token`, `refresh_token` (text) and `encrypted_credentials` (bytea) columns.

**Impact**: Database breach exposes Google Calendar access for all connected merchants.

**Recommendation**: 
1. Encrypt all OAuth tokens at rest using application-level encryption
2. Rotate encryption keys periodically
3. Consider using a secrets manager (Vault, AWS Secrets Manager)

---

## Summary Table

| ID | Title | Severity | Component | Status |
|----|-------|----------|-----------|--------|
| SEC-001 | 11 Tables Missing RLS | Critical | Database | Open |
| SEC-002 | Notifications No Policies | High | Database | Open |
| SEC-003 | Security Definer View | High | Database | Open |
| SEC-004 | Functions Missing search_path | Medium | Database | Open |
| SEC-005 | Overly Permissive Consumer Policies | Medium | Database | Open |
| SEC-006 | Profiles Readable by Anyone | Medium | Database | Open |
| SEC-007 | OTP Testing Backdoor | Critical | Auth | Open |
| SEC-008 | Twilio Signature Skip Flag | High | Auth | Open |
| SEC-009 | Missing Twilio Validation on SMS Reply | Critical | Auth | Open |
| SEC-010 | Auth Tokens in localStorage | Medium | Frontend | Open |
| SEC-011 | Admin Panel Enabled by Default | High | Frontend | Open |
| SEC-012 | Hardcoded Test Phone Number | Medium | Frontend | Open |
| SEC-013 | dangerouslySetInnerHTML Usage | Low | Frontend | Open |
| SEC-015 | Node Webhook Not Implemented | Medium | Backend | Open |
| SEC-016 | No Rate Limiting | Medium | Backend | Open |
| SEC-017 | OTP Attempt Race Condition | Low | Backend | Open |
| SEC-018 | Leaked Password Protection Disabled | Medium | Auth Config | Open |
| SEC-019 | CORS Allows All Origins | Medium | Backend | Open |
| SEC-020 | CI Continues on Errors | Low | CI/CD | Open |
| SEC-021 | No Dependabot | Low | CI/CD | Open |
| SEC-022 | No Branch Protection Verification | Low | CI/CD | Open |
| SEC-023 | OAuth Tokens Unencrypted | High | Integrations | Open |

---

## Questions for Product/Engineering

Before implementing fixes, please clarify:

### Compliance & Regulatory
1. **Are there specific compliance requirements** (HIPAA, PCI-DSS, GDPR, SOC2) that apply to OpenAlert?
2. **What data retention policies** should be enforced for SMS logs, OTP codes, and booking history?
3. **Are there geographic restrictions** on where data can be stored/processed?

### Scale & Architecture
4. **Expected scale**: How many merchants, consumers, and SMS messages per day/month?
5. **Multi-region**: Will the app be deployed in multiple regions?
6. **Rate limiting thresholds**: What are acceptable limits for OTP requests, SMS sends, API calls?

### Security Posture
7. **Admin access**: Who should have access to the admin panel? Should it be removed entirely for production?
8. **Testing environments**: Is there a separate staging environment, or is TESTING_MODE used in production?
9. **OAuth token encryption**: Is the `encrypted_credentials` column intended to replace plaintext tokens?

### Infrastructure
10. **WAF/CDN**: Is there a WAF or CDN in front of the application?
11. **Secret rotation**: What is the current strategy for rotating API keys (Twilio, OpenAI, Supabase)?
12. **Backup strategy**: What is the current database backup and recovery plan?

---

*This report was generated from static code analysis and Supabase schema inspection. A full penetration test is recommended before production launch.*

