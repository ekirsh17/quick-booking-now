# Deployment Environment Variables Guide

This guide provides platform-specific instructions for setting up environment variables when deploying to production.

## Overview

The application has three deployment contexts:
1. **Frontend** - Static site (Vercel, Netlify, Cloudflare Pages, etc.)
2. **Backend Server** - Node/Express API (Vercel, Railway, Render, etc.)
3. **Edge Functions** - Supabase Edge Functions (managed in Supabase Dashboard)

## Frontend Deployment

### Vercel

1. Go to your Vercel project dashboard
2. Navigate to: Settings > Environment Variables
3. Add the following variables (use `.env.example` as reference):

**Required:**
- `VITE_SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (get from Supabase Dashboard > Settings > API > anon key)
- `VITE_SUPABASE_PROJECT_ID` = `gawcuwlmvcveddqjjqxc`

**Optional:**
- `VITE_API_URL` = (your backend server URL, e.g., `https://api.yourdomain.com`)
- `VITE_STRIPE_PUBLISHABLE_KEY` = (for billing)
- `VITE_PAYPAL_CLIENT_ID` = (for billing)
- `VITE_ENABLE_ADMIN` = `false` (never `true` in production)

4. Set environment-specific values:
   - **Production**: Use production API URLs and keys
   - **Preview**: Use staging/test URLs and keys
   - **Development**: Use localhost URLs

5. Redeploy after adding variables

### Netlify

1. Go to Site settings > Environment variables
2. Add the same variables as Vercel (see above)
3. Set build command: `pnpm build` or `npm run build`
4. Set publish directory: `dist`

### Other Platforms

Follow the same pattern:
- Add all `VITE_*` prefixed variables
- Use production URLs and keys
- Never set `VITE_ENABLE_ADMIN=true` in production

## Backend Server Deployment

### Vercel

1. Go to your Vercel project dashboard (or create a separate project for the backend)
2. Navigate to: Settings > Environment Variables
3. Add the following variables (use `server/.env.example` as reference):

**Required:**
- `SUPABASE_URL` = `https://gawcuwlmvcveddqjjqxc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (get from Supabase Dashboard > Settings > API > service_role key)
- `TWILIO_ACCOUNT_SID` = (get from Twilio Console)
- `TWILIO_AUTH_TOKEN` = (get from Twilio Console)
- `TWILIO_PHONE_NUMBER` = `+18448203482`
- `TWILIO_WEBHOOK_URL` = (your deployed backend URL + `/webhooks/twilio-sms`)
- `OPENAI_API_KEY` = (get from OpenAI Platform)

**Billing (Required if using payments):**
- `STRIPE_SECRET_KEY` = (get from Stripe Dashboard)
- `STRIPE_PUBLISHABLE_KEY` = (get from Stripe Dashboard)
- `STRIPE_WEBHOOK_SECRET` = (get from Stripe Dashboard > Webhooks)
- `PAYPAL_CLIENT_ID` = (get from PayPal Developer Dashboard)
- `PAYPAL_CLIENT_SECRET` = (get from PayPal Developer Dashboard)
- `PAYPAL_WEBHOOK_ID` = (get from PayPal Developer Dashboard > Webhooks)
- `PAYPAL_MODE` = `sandbox` or `live`

**Optional:**
- `PORT` = (usually auto-set by platform, default: 3001)
- `NODE_ENV` = `production`
- `TWILIO_MESSAGING_SERVICE_SID` = (if using messaging service)
- `FRONTEND_URL` = (your frontend URL for OAuth callbacks)

4. Configure Vercel for Node.js:
   - Build command: `cd server && npm install && npm run build`
   - Output directory: `server/dist` (or as configured)
   - Install command: `npm install` (in server directory)

### Railway

1. Create a new Railway project
2. Connect your GitHub repository
3. Set root directory to `server/`
4. Add environment variables in Railway dashboard:
   - Same variables as Vercel (see above)
5. Railway will auto-detect Node.js and deploy

### Render

1. Create a new Web Service
2. Connect your GitHub repository
3. Set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add environment variables in Render dashboard:
   - Same variables as Vercel (see above)

## Edge Functions (Supabase)

Edge Functions secrets are managed in Supabase Dashboard, not in deployment platforms.

### Setup Instructions

1. Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets
2. Add all required secrets (see [docs/EDGE_FUNCTIONS_ENV.md](EDGE_FUNCTIONS_ENV.md))
3. Secrets are automatically available to all edge functions
4. No need to redeploy functions after adding secrets

### Required Secrets

See [docs/EDGE_FUNCTIONS_ENV.md](EDGE_FUNCTIONS_ENV.md) for complete list. Key secrets include:

- `SUPABASE_URL` (usually auto-set)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (for stripe-webhook)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` (for paypal-webhook)
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDAR_ENCRYPTION_KEY` (for calendar)
- `SLOT_LINK_SIGNING_SECRET` (for resolve-slot)
- `FRONTEND_URL` (for OAuth callbacks)

## Environment-Specific Configuration

### Development
- **Frontend URL**: `http://localhost:8080`
- **Backend URL**: `http://localhost:3001`
- **API Keys**: Use test/sandbox keys
- **PayPal Mode**: `sandbox`
- **Stripe**: Use test keys (`pk_test_*`, `sk_test_*`)

### Staging
- **Frontend URL**: `https://staging.yourdomain.com`
- **Backend URL**: `https://api-staging.yourdomain.com`
- **API Keys**: Use test/sandbox keys (or separate staging keys)
- **PayPal Mode**: `sandbox`
- **Stripe**: Use test keys

### Production
- **Frontend URL**: `https://yourdomain.com`
- **Backend URL**: `https://api.yourdomain.com`
- **API Keys**: Use production/live keys
- **PayPal Mode**: `live`
- **Stripe**: Use live keys (`pk_live_*`, `sk_live_*`)
- **Never enable**: `TESTING_MODE`, `SKIP_TWILIO_SIGNATURE_VALIDATION`, `VITE_ENABLE_ADMIN`

## CI/CD Integration

### GitHub Actions

Example workflow for validating environment variables:

```yaml
name: Validate Environment

on: [push, pull_request]

jobs:
  validate-env:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate frontend env
        run: node scripts/validate-env.js --frontend
      - name: Validate backend env
        run: node scripts/validate-env.js --backend
```

### Pre-deployment Checklist

Before deploying to production:

- [ ] All required environment variables are set
- [ ] No placeholder values in production environment
- [ ] Production-unsafe flags are disabled (`TESTING_MODE=false`, `VITE_ENABLE_ADMIN=false`)
- [ ] Webhook URLs are correct for production
- [ ] API keys are production keys (not test/sandbox)
- [ ] CORS settings allow production frontend URL
- [ ] Edge function secrets are set in Supabase Dashboard
- [ ] Validation script passes: `node scripts/validate-env.js`

## Secret Rotation Procedures

### When to Rotate
- Quarterly (recommended)
- After security incident
- When team member leaves
- When key is accidentally exposed

### Rotation Steps

1. **Generate new keys** in respective dashboards:
   - Supabase: Settings > API > Regenerate keys
   - Twilio: Console > Regenerate Auth Token
   - Stripe: Dashboard > API keys > Create new key
   - PayPal: Developer Dashboard > Create new app
   - OpenAI: Platform > API keys > Create new key

2. **Update in all locations**:
   - Frontend deployment platform (Vercel, etc.)
   - Backend deployment platform (Vercel, Railway, etc.)
   - Supabase Edge Functions secrets
   - Local `.env` files (for development)

3. **Test** that everything still works

4. **Revoke old keys** after confirming new keys work

5. **Document** rotation date in team notes

## Troubleshooting

### Variables Not Available in Production

- **Vercel**: Check that variables are set for "Production" environment (not just Preview)
- **Railway/Render**: Verify variables are set in the correct service
- **Edge Functions**: Check Supabase Dashboard > Settings > Edge Functions > Secrets

### Variables Work Locally But Not in Production

- Check for typos in variable names (case-sensitive)
- Verify environment-specific values (production vs. preview)
- Check that build process includes environment variables
- For Vite: Ensure variables are prefixed with `VITE_`

### Webhook URLs Not Working

- Verify `TWILIO_WEBHOOK_URL` points to your deployed backend
- Check that backend server is accessible from internet
- Verify webhook secrets match between platform and service (Stripe, PayPal)

## Security Checklist

- [ ] All secrets are stored in platform secret management (not in code)
- [ ] `.env` files are gitignored
- [ ] Production-unsafe flags are disabled
- [ ] API keys are production keys (not test keys in production)
- [ ] Webhook secrets are set and verified
- [ ] CORS is configured for production domains only
- [ ] Access to secret management is limited to necessary team members
- [ ] Secret rotation schedule is documented

## Quick Reference

### Get Supabase Keys
- URL: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/api
- Anon key → `VITE_SUPABASE_PUBLISHABLE_KEY` (frontend)
- Service role key → `SUPABASE_SERVICE_ROLE_KEY` (backend + edge functions)

### Get Twilio Credentials
- URL: https://console.twilio.com/
- Account SID → `TWILIO_ACCOUNT_SID`
- Auth Token → `TWILIO_AUTH_TOKEN`
- Phone Number → `TWILIO_PHONE_NUMBER` (currently: `+18448203482`)

### Get Stripe Keys
- URL: https://dashboard.stripe.com/apikeys
- Publishable key → `VITE_STRIPE_PUBLISHABLE_KEY` (frontend) or `STRIPE_PUBLISHABLE_KEY` (backend)
- Secret key → `STRIPE_SECRET_KEY` (backend)
- Webhook secret → `STRIPE_WEBHOOK_SECRET` (from Webhooks section)

### Get PayPal Credentials
- URL: https://developer.paypal.com/dashboard/applications
- Client ID → `PAYPAL_CLIENT_ID` or `VITE_PAYPAL_CLIENT_ID`
- Client Secret → `PAYPAL_CLIENT_SECRET`
- Webhook ID → `PAYPAL_WEBHOOK_ID` (from Webhooks section)

