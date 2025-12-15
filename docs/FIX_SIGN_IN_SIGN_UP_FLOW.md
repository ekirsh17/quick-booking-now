# Fix Sign In/Sign Up Flow - Twilio Configuration Issue

## Problem

The sign in/sign up flow fails with error:
```
TWILIO_MESSAGING_SERVICE_SID not configured
```

This happens because the `send-sms` edge function requires either:
- `USE_DIRECT_NUMBER=true` (to use direct phone number), OR
- `TWILIO_MESSAGING_SERVICE_SID` (to use messaging service)

Currently, `USE_DIRECT_NUMBER` is not set (defaults to `false`), so the function tries to use messaging service but `TWILIO_MESSAGING_SERVICE_SID` is missing.

## Quick Fix (Recommended)

Set `USE_DIRECT_NUMBER=true` in Supabase Edge Functions secrets.

### Steps

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc
   - Or: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets

2. **Add/Update Secret**
   - Click **"Add new secret"** or find existing `USE_DIRECT_NUMBER`
   - **Name**: `USE_DIRECT_NUMBER`
   - **Value**: `true` (must be the string `"true"`, not boolean)
   - Click **Save**

3. **Verify Required Secrets Are Set**
   Make sure these are configured:
   - ✅ `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
   - ✅ `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
   - ✅ `TWILIO_PHONE_NUMBER` - Your Twilio phone number (e.g., `+18448203482`)
   - ✅ `USE_DIRECT_NUMBER` - Set to `true` (this is what you're adding)
   - ✅ `SUPABASE_URL` - Usually auto-set by Supabase
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` - Usually auto-set by Supabase

4. **No Redeploy Needed**
   - Secrets are automatically available to all edge functions
   - Changes take effect immediately (no redeploy required)

## Alternative: Use Messaging Service

If you prefer to use Twilio Messaging Service instead:

1. **Get Messaging Service SID**
   - Go to Twilio Console: https://console.twilio.com/
   - Navigate to: Messaging → Services
   - Create a new service or get existing service SID (starts with `MG...`)

2. **Set in Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets
   - Add secret: `TWILIO_MESSAGING_SERVICE_SID` = `your-messaging-service-sid`
   - Ensure `USE_DIRECT_NUMBER` is NOT set or set to `false`

## Verification

After setting the configuration:

1. **Test Sign In Flow**
   - Go to your app's sign in page
   - Enter a phone number
   - You should receive an OTP code via SMS

2. **Check Edge Function Logs**
   - Go to Supabase Dashboard → Edge Functions → `generate-otp` → Logs
   - Should show: `"SMS sent successfully"`
   - Should NOT show: `"TWILIO_MESSAGING_SERVICE_SID not configured"`

3. **Check `verify-otp` Logs**
   - After entering OTP code, check `verify-otp` function logs
   - Should show: `"OTP verification successful"`
   - User should be signed in

## Why This Happens

The `send-sms` edge function has conditional logic:

```typescript
if (USE_DIRECT_NUMBER) {
  // Use direct phone number
  twilioParams.From = TWILIO_PHONE_NUMBER;
} else {
  // Use messaging service (requires TWILIO_MESSAGING_SERVICE_SID)
  twilioParams.MessagingServiceSid = MESSAGING_SERVICE_SID;
}
```

If `USE_DIRECT_NUMBER` is not set, it defaults to `false`, so the function tries to use messaging service but fails if `TWILIO_MESSAGING_SERVICE_SID` is missing.

## Related Documentation

- [Edge Functions Environment Variables](EDGE_FUNCTIONS_ENV_VARS.md)
- [Setup Twilio Environment Variables](SETUP_TWILIO_ENV_VARS.md)
- [Edge Functions Setup](EDGE_FUNCTIONS_SETUP.md)

