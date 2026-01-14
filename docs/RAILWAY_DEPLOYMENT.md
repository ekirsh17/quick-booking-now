# Railway Backend Server Deployment Guide

This guide provides all environment variables and setup instructions for deploying the backend server to Railway.

## Quick Setup

1. **Create Railway Project**: Connect your GitHub repository or deploy from CLI
2. **Add Environment Variables**: Copy values from the sections below
3. **Deploy**: Railway will automatically build and deploy your server
4. **Update Webhook URLs**: After deployment, update `TWILIO_WEBHOOK_URL` with your Railway domain

## Environment Variables

### Required Variables (Copy-Paste Ready)

Add these to Railway's "Variables" tab:

```bash
# Supabase Configuration
SUPABASE_URL=https://gawcuwlmvcveddqjjqxc.supabase.co
# Get from Supabase Dashboard > Settings > API > service_role key
# IMPORTANT: Use the service_role key from the production project (gawcuwlmvcveddqjjqxc)
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key-here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+18448203482

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Server Configuration
PORT=3001
NODE_ENV=production

# Frontend URL (Production)
FRONTEND_URL=https://www.openalert.org
```

### Post-Deployment Variable (Update After Deploy)

After Railway provides your deployment URL, update this variable:

```bash
# Twilio Webhook URL (update with your Railway domain)
TWILIO_WEBHOOK_URL=https://your-railway-app.up.railway.app/webhooks/twilio-sms
```

**Steps to update:**
1. Deploy your service on Railway
2. Railway will provide a URL like: `https://your-app-name.up.railway.app`
3. Add/update `TWILIO_WEBHOOK_URL` in Railway Variables with: `https://your-app-name.up.railway.app/webhooks/twilio-sms`
4. Update the webhook URL in Twilio Console to point to this Railway URL

### Optional Variables (Billing - Not Configured Yet)

These are only needed if you're using Stripe or PayPal billing. Currently not configured:

```bash
# Stripe (if using billing - NOT configured yet)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# PayPal (if using billing - NOT configured yet)
# PAYPAL_CLIENT_ID=
# PAYPAL_CLIENT_SECRET=
```

## Setup Instructions

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or use Railway CLI)
4. Select your repository
5. Railway will detect the `server/` directory automatically

### Step 2: Configure Build Settings

Railway should auto-detect Node.js, but verify:

- **Root Directory**: `server` (if deploying only the server)
- **Build Command**: `npm install` (or `pnpm install`)
- **Start Command**: `npm start` (or `node dist/index.js` if using TypeScript)
- **Node Version**: 18.x or 20.x (check `server/package.json`)

### Step 3: Add Environment Variables

1. Go to your Railway project dashboard
2. Click on your service
3. Navigate to the "Variables" tab
4. Click "New Variable" for each variable above
5. Copy-paste the exact values from the "Required Variables" section

### Step 4: Deploy

1. Railway will automatically deploy after you add variables
2. Check the "Deployments" tab for build logs
3. Once deployed, Railway will provide a public URL

### Step 5: Update Webhook URLs

After deployment:

1. **Get your Railway URL**: From Railway dashboard (e.g., `https://your-app.up.railway.app`)
2. **Update Railway Variable**: Add/update `TWILIO_WEBHOOK_URL` with your full webhook path
3. **Update Twilio Console**:
   - Go to [Twilio Console](https://console.twilio.com)
   - Navigate to Phone Numbers > Manage > Active Numbers
   - Click on your phone number (`+18448203482`)
   - Under "Messaging", update "Webhook URL" to: `https://your-app.up.railway.app/webhooks/twilio-sms`
   - Set HTTP method to: `POST`
   - Click "Save"

## Verification

After deployment, verify your server is running:

1. **Health Check**: Visit `https://your-app.up.railway.app/health` (should return `{"status":"ok"}`)
2. **Check Logs**: Railway dashboard > Deployments > View logs
3. **Test Twilio Webhook**: Send a test SMS to your Twilio number and check Railway logs

## Important Notes

### Supabase URL Verification

**Important**: Verify your Supabase project URL matches:

- **Documented URL**: `https://gawcuwlmvcveddqjjqxc.supabase.co`
- **Service Role Key**: Matches the project above

If you're using a different Supabase project, you'll need to:
1. Get the correct `SUPABASE_URL` from your Supabase Dashboard
2. Get the correct `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard > Settings > API

### Environment Variable Sources

All values are documented in:
- **Edge Functions Secrets**: [docs/EDGE_FUNCTIONS_SETUP.md](EDGE_FUNCTIONS_SETUP.md)
- **Environment Variables**: [docs/ENVIRONMENT.md](ENVIRONMENT.md)
- **Missing Variables**: [MISSING_ENV_VARS.md](../MISSING_ENV_VARS.md)

### Security Reminders

- ✅ Never commit `.env` files to git
- ✅ Use Railway's environment variables (not hardcoded values)
- ✅ Rotate keys periodically
- ✅ Use different keys for dev/staging/prod (if using multiple environments)
- ⚠️ Never enable `TESTING_MODE` or `SKIP_TWILIO_SIGNATURE_VALIDATION` in production

## Troubleshooting

### Server Won't Start

1. **Check Logs**: Railway dashboard > Deployments > View logs
2. **Verify Variables**: Ensure all required variables are set
3. **Check Port**: Railway sets `PORT` automatically, but verify it's `3001` or matches your config
4. **Node Version**: Ensure Node.js version matches `server/package.json`

### Twilio Webhooks Not Working

1. **Verify Webhook URL**: Check `TWILIO_WEBHOOK_URL` in Railway matches your actual Railway domain
2. **Check Twilio Console**: Ensure webhook URL in Twilio matches Railway URL
3. **Check Logs**: Railway logs will show incoming webhook requests
4. **Test Manually**: Use `curl` to test your webhook endpoint

### Database Connection Issues

1. **Verify Supabase URL**: Check `SUPABASE_URL` is correct
2. **Verify Service Role Key**: Check `SUPABASE_SERVICE_ROLE_KEY` matches your Supabase project
3. **Check Supabase Dashboard**: Ensure your project is active and accessible

## Related Documentation

- [Environment Variables Guide](ENVIRONMENT.md) - Complete list of all environment variables
- [Edge Functions Setup](EDGE_FUNCTIONS_SETUP.md) - Supabase Edge Functions secrets
- [Deployment Guide](DEPLOYMENT_ENV_VARS.md) - Platform-specific deployment instructions
- [Server README](../server/README.md) - Backend server documentation

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify all environment variables are set correctly
3. Review [docs/ENVIRONMENT.md](ENVIRONMENT.md) for variable requirements
4. Check server logs for specific error messages
