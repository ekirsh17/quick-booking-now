# Missing Environment Variables

This document lists environment variables that still need to be configured.

## ✅ Variables Already Configured

### Frontend (.env)
- ✅ VITE_SUPABASE_URL
- ✅ VITE_SUPABASE_PUBLISHABLE_KEY
- ✅ VITE_SUPABASE_PROJECT_ID
- ⚠️ VITE_STRIPE_PUBLISHABLE_KEY (required for billing)
- ⚠️ VITE_PAYPAL_CLIENT_ID (required for billing)

### Backend (server/.env)
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ TWILIO_ACCOUNT_SID
- ✅ TWILIO_AUTH_TOKEN
- ✅ TWILIO_PHONE_NUMBER
- ❌ OPENAI_API_KEY (required for SMS parsing)

### Edge Functions (Supabase Dashboard)
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ SUPABASE_ANON_KEY
- ✅ TWILIO_ACCOUNT_SID
- ✅ TWILIO_AUTH_TOKEN
- ✅ TWILIO_PHONE_NUMBER
- ✅ USE_DIRECT_NUMBER
- ✅ INTAKE_SECRET
- ✅ SLOT_LINK_SIGNING_SECRET
- ✅ GOOGLE_OAUTH_CLIENT_ID
- ✅ GOOGLE_OAUTH_CLIENT_SECRET
- ✅ CALENDAR_ENCRYPTION_KEY
- ✅ FRONTEND_URL

## ❌ Missing Variables

### Required for Core Functionality

**OPENAI_API_KEY**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Get from**: https://platform.openai.com/api-keys
- **Required for**: SMS parsing (`parse-sms-opening` function)
- **Format**: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`


### Required for Billing (if using payments)

**STRIPE_SECRET_KEY**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Get from**: https://dashboard.stripe.com/apikeys
- **Required for**: Stripe webhooks and server-side operations

**STRIPE_PUBLISHABLE_KEY**
- **Where**: `server/.env` (backend) and `.env` as `VITE_STRIPE_PUBLISHABLE_KEY` (frontend)
- **Get from**: https://dashboard.stripe.com/apikeys
- **Required for**: Frontend Stripe.js integration

**STRIPE_WEBHOOK_SECRET**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Get from**: Stripe Dashboard > Webhooks > Signing secret
- **Required for**: Webhook signature verification

**PAYPAL_CLIENT_ID**
- **Where**: `server/.env` (backend) and `.env` as `VITE_PAYPAL_CLIENT_ID` (frontend)
- **Get from**: https://developer.paypal.com/dashboard/applications
- **Required for**: PayPal checkout

**PAYPAL_CLIENT_SECRET**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Get from**: https://developer.paypal.com/dashboard/applications
- **Required for**: PayPal API calls

**PAYPAL_WEBHOOK_ID**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Get from**: PayPal Developer Dashboard > Webhooks
- **Required for**: PayPal webhook verification



### Optional/Production Variables

**TWILIO_WEBHOOK_URL**
- **Where**: `server/.env`
- **Development**: `http://localhost:3001/webhooks/twilio-sms` (already set)
- **Production**: `https://your-domain.com/webhooks/twilio-sms`
- **Required for**: Production Twilio webhooks

**TWILIO_MESSAGING_SERVICE_SID**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Get from**: Twilio Console > Messaging Services
- **Required if**: Using messaging service instead of direct number


**TZ_FALLBACK**
- **Where**: Supabase Edge Functions secrets only
- **Default**: `America/New_York`
- **Required for**: Fallback timezone for SMS parsing

## Quick Reference

### Priority 1 (Required for Core Functionality)
1. **OPENAI_API_KEY** - Required for SMS parsing

### Priority 2 (Required for Billing - if using)
2. **STRIPE_SECRET_KEY** + **STRIPE_PUBLISHABLE_KEY** + **STRIPE_WEBHOOK_SECRET**
3. **PAYPAL_CLIENT_ID** + **PAYPAL_CLIENT_SECRET** + **PAYPAL_WEBHOOK_ID**

### Priority 3 (Required for Calendar - if using)
- ✅ **GOOGLE_OAUTH_CLIENT_ID** + **GOOGLE_OAUTH_CLIENT_SECRET** + **CALENDAR_ENCRYPTION_KEY** (configured)

### Priority 4 (Required for Specific Features)
- ✅ **SLOT_LINK_SIGNING_SECRET** - For booking deep links (configured)
- ✅ **INTAKE_SECRET** - For SMS intake security (configured)
- ✅ **USE_DIRECT_NUMBER** - For SMS sending method (configured)
- ✅ **FRONTEND_URL** - For booking links and OAuth callbacks (configured)

### Priority 5 (Optional/Production)
7. **TWILIO_WEBHOOK_URL** - Update for production
8. **TWILIO_MESSAGING_SERVICE_SID** - If using messaging service
11. **TZ_FALLBACK** - If different from default

## Setup Instructions

1. **Frontend/Backend Variables**: Add to `.env` or `server/.env` files
2. **Edge Functions Secrets**: Add to Supabase Dashboard > Settings > Edge Functions > Secrets
3. **See**: [docs/EDGE_FUNCTIONS_SETUP.md](docs/EDGE_FUNCTIONS_SETUP.md) for Edge Functions setup guide

## Validation

After adding variables, run:
```bash
npm run validate:env              # Frontend
cd server && npm run validate:env  # Backend
```
