# Remaining Missing Environment Variables

This document lists environment variables that still need to be configured after adding INTAKE_SECRET and SLOT_LINK_SIGNING_SECRET.

## ✅ Recently Configured

- ✅ **INTAKE_SECRET** - Added to Edge Functions setup guide
- ✅ **SLOT_LINK_SIGNING_SECRET** - Added to Edge Functions setup guide
- ✅ **USE_DIRECT_NUMBER** - Added to Edge Functions setup guide
- ✅ **GOOGLE_OAUTH_CLIENT_ID** - Added to Edge Functions setup guide
- ✅ **GOOGLE_OAUTH_CLIENT_SECRET** - Added to Edge Functions setup guide
- ✅ **CALENDAR_ENCRYPTION_KEY** - Added to Edge Functions setup guide
- ✅ **FRONTEND_URL** - Added to Edge Functions setup guide

## ❌ Still Missing Variables

### High Priority (Core Functionality)

**OPENAI_API_KEY**
- **Where**: `server/.env` and Supabase Edge Functions secrets
- **Value**: `your-openai-api-key`
- **Status**: Value provided in previous plan, needs to be added to files
- **Required for**: SMS parsing (`parse-sms-opening` function)


### Low Priority (Billing - if using payments)

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
- **Current**: `http://localhost:3001/webhooks/twilio-sms` (development)
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

## Summary

### Variables with Values Provided (Need to Add to Files)
1. ❌ **OPENAI_API_KEY** - Needs to be added to `server/.env` and Edge Functions setup guide

### Variables Still Need Values (Billing - if using)
5. ❌ **STRIPE_SECRET_KEY** + **STRIPE_PUBLISHABLE_KEY** + **STRIPE_WEBHOOK_SECRET**
6. ❌ **PAYPAL_CLIENT_ID** + **PAYPAL_CLIENT_SECRET** + **PAYPAL_WEBHOOK_ID**

### Optional/Production Variables
7. ❌ **TWILIO_WEBHOOK_URL** - Update for production
8. ❌ **TWILIO_MESSAGING_SERVICE_SID** - If using messaging service
9. ❌ **TZ_FALLBACK** - If different from default

## Next Steps

1. **Add OPENAI_API_KEY** to `server/.env` file
2. **Add OPENAI_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, CALENDAR_ENCRYPTION_KEY** to Edge Functions setup guide
3. **Set all Edge Functions secrets** in Supabase Dashboard using values from `docs/EDGE_FUNCTIONS_SETUP.md`
4. **Add billing keys** if using Stripe/PayPal payments
5. **Update production URLs** when deploying to production
