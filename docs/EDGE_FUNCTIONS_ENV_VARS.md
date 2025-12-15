# Edge Functions Environment Variables

This document lists all environment variables (secrets) used by Supabase Edge Functions. These are configured in the Supabase Dashboard, not in `.env` files.

## Important Notes

- **Edge Functions use Supabase Dashboard secrets**, not local `.env` files
- These secrets are shared across all edge functions in the project
- Configure them at: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets
- Many values overlap with backend server variables, but they are managed separately

## Required Secrets

### Supabase Configuration

#### `SUPABASE_URL`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase project URL
- **Value**: `https://gawcuwlmvcveddqjjqxc.supabase.co`
- **Usage**: Edge Functions connect to Supabase
- **Note**: Usually auto-set by Supabase, but verify it's present

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase service role key (bypasses RLS)
- **Usage**: Server-side mutations, admin operations
- **Security**: Keep secret, never expose to client
- **Get from**: Supabase Dashboard > Settings > API > service_role key

#### `SUPABASE_ANON_KEY`
- **Type**: String
- **Required**: Yes (for some functions like `push-bookings-to-calendar`, `sync-calendar-events`)
- **Purpose**: Supabase anon/public key
- **Usage**: Public API access, client authentication
- **Get from**: Supabase Dashboard > Settings > API > anon/public key

### Twilio Configuration

#### `TWILIO_ACCOUNT_SID`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio account SID
- **Example**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: Twilio API authentication
- **Get from**: https://console.twilio.com/

#### `TWILIO_AUTH_TOKEN`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio auth token
- **Usage**: Twilio API authentication
- **Security**: Keep secret, never expose to client
- **Get from**: https://console.twilio.com/

#### `TWILIO_PHONE_NUMBER`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio phone number (E.164 format)
- **Value**: `+18448203482` (current production number)
- **Usage**: SMS sending, webhook handling
- **Get from**: Twilio Console > Phone Numbers

#### `TWILIO_MESSAGING_SERVICE_SID`
- **Type**: String
- **Required**: No (optional, if using messaging service instead of direct number)
- **Purpose**: Twilio messaging service SID
- **Example**: `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: SMS sending via messaging service (alternative to direct number)
- **Get from**: Twilio Console > Messaging Services

#### `USE_DIRECT_NUMBER`
- **Type**: Boolean (string: "true" or "false")
- **Required**: ⚠️ **YES** - Required for sign in/sign up flow to work
- **Purpose**: Whether to use direct phone number or messaging service
- **Values**: `"true"` or `"false"` (must be string, not boolean)
- **Usage**: Controls SMS sending method in `send-sms` and `notify-consumers` functions
- **Note**: If `true`, requires `TWILIO_PHONE_NUMBER`. If `false`, requires `TWILIO_MESSAGING_SERVICE_SID`
- **Default**: If not set, defaults to `false`, which requires `TWILIO_MESSAGING_SERVICE_SID` to be set
- **Recommended**: Set to `"true"` for quickest setup (uses existing `TWILIO_PHONE_NUMBER`)

### OpenAI Configuration

#### `OPENAI_API_KEY`
- **Type**: String
- **Required**: Yes (for SMS parsing functions)
- **Purpose**: OpenAI API key for natural language parsing
- **Example**: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: SMS intake parsing (`parse-sms-opening`)
- **Get from**: https://platform.openai.com/api-keys

### Stripe Billing (for stripe-webhook function)

#### `STRIPE_SECRET_KEY`
- **Type**: String
- **Required**: Yes (for `stripe-webhook` function)
- **Purpose**: Stripe secret API key
- **Example**: `sk_live_xxxxxxxxxxxxxxxxxxxxx` or `sk_test_xxxxxxxxxxxxxxxxxxxxx`
- **Usage**: Server-side Stripe API calls
- **Security**: Keep secret, never expose to client
- **Get from**: https://dashboard.stripe.com/apikeys

#### `STRIPE_WEBHOOK_SECRET`
- **Type**: String
- **Required**: Yes (for `stripe-webhook` function)
- **Purpose**: Stripe webhook signing secret
- **Example**: `whsec_xxxxxxxxxxxxxxxxxxxxx`
- **Usage**: Verify Stripe webhook signatures
- **Security**: Keep secret
- **Get from**: Stripe Dashboard > Developers > Webhooks > Signing secret

### PayPal Billing (for paypal-webhook function)

#### `PAYPAL_CLIENT_ID`
- **Type**: String
- **Required**: Yes (for `paypal-webhook` function)
- **Purpose**: PayPal REST API client ID
- **Example**: `AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxB`
- **Usage**: PayPal API authentication
- **Get from**: https://developer.paypal.com/dashboard/applications

#### `PAYPAL_CLIENT_SECRET`
- **Type**: String
- **Required**: Yes (for `paypal-webhook` function)
- **Purpose**: PayPal REST API client secret
- **Example**: `ExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA`
- **Usage**: PayPal API authentication
- **Security**: Keep secret, never expose to client
- **Get from**: https://developer.paypal.com/dashboard/applications

#### `PAYPAL_WEBHOOK_ID`
- **Type**: String
- **Required**: Yes (for `paypal-webhook` function)
- **Purpose**: PayPal webhook ID for signature verification
- **Example**: `8xxxxxxxxxxxxxxxxxxxxxxxxC`
- **Usage**: Verify PayPal webhook signatures
- **Security**: Keep secret
- **Get from**: PayPal Developer Dashboard > Webhooks

#### `PAYPAL_MODE`
- **Type**: String
- **Required**: No (defaults to "sandbox")
- **Purpose**: PayPal API environment
- **Values**: `"sandbox"` or `"live"`
- **Usage**: Determines which PayPal API endpoint to use
- **Note**: Use `"sandbox"` for development, `"live"` for production

### Google Calendar OAuth (for calendar functions)

#### `GOOGLE_OAUTH_CLIENT_ID`
- **Type**: String
- **Required**: Yes (for calendar integration functions)
- **Purpose**: Google OAuth client ID
- **Example**: `xxxxxxxxxxxxxxxx.apps.googleusercontent.com`
- **Usage**: Google Calendar OAuth flow
- **Get from**: Google Cloud Console > APIs & Services > Credentials

#### `GOOGLE_OAUTH_CLIENT_SECRET`
- **Type**: String
- **Required**: Yes (for calendar integration functions)
- **Purpose**: Google OAuth client secret
- **Example**: `GOCSPX-xxxxxxxxxxxxxxxx`
- **Usage**: Google Calendar OAuth flow
- **Security**: Keep secret, never expose to client
- **Get from**: Google Cloud Console > APIs & Services > Credentials

#### `CALENDAR_ENCRYPTION_KEY`
- **Type**: String
- **Required**: Yes (for calendar integration functions)
- **Purpose**: Encryption key for calendar credentials
- **Example**: `your_32_character_encryption_key_here`
- **Usage**: Encrypt/decrypt Google Calendar OAuth tokens
- **Security**: Keep secret, use strong random key (32+ characters)
- **Generate**: `openssl rand -hex 32`

### Slot Link Signing (for resolve-slot function)

#### `SLOT_LINK_SIGNING_SECRET`
- **Type**: String
- **Required**: Yes (for `resolve-slot` function)
- **Purpose**: HMAC secret for signing booking deep links
- **Usage**: Prevents tampering with booking URLs
- **Security**: Keep secret, use strong random key
- **Generate**: `openssl rand -hex 32`

### SMS Intake (optional, for parse-sms-opening function)

#### `INTAKE_SECRET`
- **Type**: String
- **Required**: No (optional, for HMAC validation)
- **Purpose**: Secret key for HMAC signature validation
- **Usage**: Validate API requests to intake endpoints
- **Security**: Keep secret, use strong random key
- **Generate**: `openssl rand -hex 32`

#### `TZ_FALLBACK`
- **Type**: String
- **Required**: No (optional, defaults to "America/New_York")
- **Purpose**: Fallback timezone for SMS parsing
- **Example**: `America/New_York`
- **Usage**: Default timezone when merchant timezone is not set

### Frontend URL (for OAuth callbacks)

#### `FRONTEND_URL`
- **Type**: String
- **Required**: No (optional, for OAuth callbacks)
- **Purpose**: Frontend application URL
- **Example**: `http://localhost:8080` (development) or `https://your-domain.com` (production)
- **Usage**: OAuth callback redirects, CORS configuration
- **Note**: Required for calendar OAuth functions

## Development-Only Flags (NEVER use in production)

### `TESTING_MODE`
- **Type**: Boolean (string: "true" or "false")
- **Required**: No
- **Purpose**: Enable testing mode (restricts SMS to verified test numbers)
- **Values**: `"true"` or `"false"` (must be string)
- **Security**: ⚠️ **NEVER set to "true" in production**
- **Usage**: Used in `send-sms` and `verify-otp` functions
- **Note**: If enabled, only sends SMS to verified test number (`+15165879844`)

### `SKIP_TWILIO_SIGNATURE_VALIDATION`
- **Type**: Boolean (string: "true" or "false")
- **Required**: No
- **Purpose**: Skip Twilio webhook signature validation (for testing only)
- **Values**: `"true"` or `"false"` (must be string)
- **Security**: ⚠️ **NEVER set to "true" in production** - major security risk
- **Usage**: Used in `twilio-status-callback` function
- **Note**: Only use during local development/testing

## Function-Specific Secrets

### Functions that use most secrets:
- `send-sms`: Twilio, Supabase, USE_DIRECT_NUMBER, TESTING_MODE
- `notify-consumers`: Twilio, Supabase, FRONTEND_URL, USE_DIRECT_NUMBER
- `handle-sms-reply`: Twilio, Supabase
- `parse-sms-opening`: OpenAI, Supabase, INTAKE_SECRET, TZ_FALLBACK
- `stripe-webhook`: Stripe secrets, Supabase
- `paypal-webhook`: PayPal secrets, Supabase
- `push-bookings-to-calendar`: Google OAuth, Supabase, CALENDAR_ENCRYPTION_KEY
- `sync-calendar-events`: Google OAuth, Supabase, CALENDAR_ENCRYPTION_KEY
- `resolve-slot`: Supabase, SLOT_LINK_SIGNING_SECRET
- `verify-otp`: Supabase, TESTING_MODE

## Setup Instructions

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc
2. Navigate to: Settings > Edge Functions > Secrets
3. Add each secret with its value
4. Secrets are automatically available to all edge functions
5. No need to redeploy functions after adding secrets (they're picked up automatically)

## Security Best Practices

1. **Never commit secrets**: Edge function secrets are stored in Supabase Dashboard, not in code
2. **Use strong keys**: Generate random, long keys for sensitive variables (use `openssl rand -hex 32`)
3. **Rotate keys**: Periodically rotate API keys and secrets
4. **Limit access**: Only grant access to necessary team members in Supabase Dashboard
5. **Monitor usage**: Track API usage and costs
6. **Use environment-specific keys**: Different keys for dev/staging/prod (if using multiple Supabase projects)
7. **Never enable TESTING_MODE or SKIP_TWILIO_SIGNATURE_VALIDATION in production**

## Troubleshooting

### Missing Secrets
- Check Supabase Dashboard > Settings > Edge Functions > Secrets
- Verify secret names match exactly (case-sensitive)
- Check function logs for specific missing secret errors

### Invalid Values
- Verify URLs are correct and accessible
- Check API keys are valid and not expired
- Ensure phone numbers are in E.164 format (+1234567890)
- Verify boolean values are strings ("true"/"false"), not actual booleans

### Secret Not Available in Function
- Secrets are shared across all functions
- If a secret is set but not accessible, check the secret name spelling
- Some secrets may be auto-set by Supabase (like SUPABASE_URL)

