# Edge Functions Secrets Setup Guide

This guide lists the required secret names and where to obtain them. Do not store real secret values in git.

## Quick Setup

Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets

## Required Secrets to Set

### Supabase Configuration

**SUPABASE_URL**
- Source: Supabase project settings

**SUPABASE_SERVICE_ROLE_KEY**
- Source: Supabase project API settings (keep private)

**SUPABASE_ANON_KEY**
- Source: Supabase project API settings

### Twilio Configuration

**TWILIO_ACCOUNT_SID**
- Source: Twilio Console > Account

**TWILIO_AUTH_TOKEN**
- Source: Twilio Console > Account (keep private)

**TWILIO_PHONE_NUMBER**
- Source: Twilio Console > Phone Numbers

### Twilio SMS Configuration

**USE_DIRECT_NUMBER**
- Value: `true` or `false`

### SMS Intake Security

**INTAKE_SECRET**
- Source: Generate a strong random secret (keep private)

### Booking Link Security

**SLOT_LINK_SIGNING_SECRET**
- Source: Generate a strong random secret (keep private)

### Google Calendar OAuth

**GOOGLE_OAUTH_CLIENT_ID**
- Source: Google Cloud Console > OAuth credentials

**GOOGLE_OAUTH_CLIENT_SECRET**
- Source: Google Cloud Console > OAuth credentials (keep private)

**CALENDAR_ENCRYPTION_KEY**
- Source: Generate a strong random secret (keep private)

### Frontend URL

**FRONTEND_URL**
- Value: `https://www.openalert.org`

## Still Need to Configure

### Required for Core Functionality

**OPENAI_API_KEY**
- Get from: https://platform.openai.com/api-keys
- Required for: SMS parsing (`parse-sms-opening` function)
- Format: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`


### Required for Billing (if using)

**STRIPE_SECRET_KEY**
- Get from: https://dashboard.stripe.com/apikeys
- Required for: `stripe-webhook` function

**STRIPE_WEBHOOK_SECRET**
- Get from: Stripe Dashboard > Webhooks > Signing secret
- Required for: `stripe-webhook` function

**PAYPAL_CLIENT_ID**
- Get from: https://developer.paypal.com/dashboard/applications
- Required for: `paypal-webhook` function

**PAYPAL_CLIENT_SECRET**
- Get from: https://developer.paypal.com/dashboard/applications
- Required for: `paypal-webhook` function

**PAYPAL_WEBHOOK_ID**
- Get from: PayPal Developer Dashboard > Webhooks
- Required for: `paypal-webhook` function

### Optional/Production

**TWILIO_MESSAGING_SERVICE_SID**
- Get from: Twilio Console > Messaging Services
- Required if: `USE_DIRECT_NUMBER=false`

**TZ_FALLBACK**
- Default: `America/New_York`
- Required for: Fallback timezone for SMS parsing

## Setup Instructions

1. Navigate to Supabase Dashboard: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc
2. Go to: Settings > Edge Functions > Secrets
3. Click "Add Secret" for each variable above
4. Copy and paste the exact values provided
5. Click "Save" after each secret

## Important Notes

- Secrets are automatically available to all edge functions
- No need to redeploy functions after adding secrets
- All secrets are case-sensitive
- Boolean values must be strings: `"true"` or `"false"`, not actual booleans
- See [docs/EDGE_FUNCTIONS_ENV_VARS.md](EDGE_FUNCTIONS_ENV_VARS.md) for complete documentation

## Security Reminders

- Never commit secrets to git
- Rotate keys periodically
- Use different keys for dev/staging/prod (if using multiple Supabase projects)
- Never enable `TESTING_MODE` or `SKIP_TWILIO_SIGNATURE_VALIDATION` in production
