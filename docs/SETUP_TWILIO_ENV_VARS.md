# How to Set Twilio Environment Variables in Supabase

## Quick Fix: Set USE_DIRECT_NUMBER

### Step 1: Go to Supabase Dashboard

1. Navigate to: https://supabase.com/dashboard
2. Select your project: `thuelgbhfoaqbaaojezb`
3. Go to **Edge Functions** in the left sidebar
4. Click on **`send-sms`** function
5. Click on **Settings** tab

### Step 2: Add/Update Environment Variable

In the **Environment Variables** section:

1. **Variable Name**: `USE_DIRECT_NUMBER`
2. **Variable Value**: `true`
3. Click **Save** or **Add**

### Step 3: Verify All Required Variables

Make sure these are set:

- ✅ `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- ✅ `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token  
- ✅ `TWILIO_PHONE_NUMBER` - Your Twilio phone number (e.g., `+1234567890`)
- ✅ `USE_DIRECT_NUMBER` - Set to `true` (this is what you're adding)
- ✅ `SUPABASE_URL` - Auto-set by Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase

### Step 4: Redeploy Function (if needed)

After setting environment variables, the function should automatically pick them up. If not:

1. Go to Edge Functions → `send-sms`
2. Click **Redeploy** or wait a few seconds for auto-reload

### Step 5: Test the Configuration

Test the health check:

```bash
curl -X GET "https://thuelgbhfoaqbaaojezb.supabase.co/functions/v1/send-sms" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Should return:
```json
{
  "ready": true,
  "issues": []
}
```

## Why NOT to Hardcode in Code

❌ **DON'T** do this in the code:
```typescript
USE_DIRECT_NUMBER = true;  // ❌ Hardcoded - will be overridden!
```

✅ **DO** set it as an environment variable in Supabase Dashboard

**Reasons:**
1. Environment variables can be changed without redeploying code
2. Different environments (dev/staging/prod) can have different settings
3. Keeps secrets and configuration out of code
4. The code reads from `Deno.env.get('USE_DIRECT_NUMBER')` which overrides any hardcoded value

## Alternative: Use Messaging Service

If you prefer to use Twilio Messaging Service instead:

1. Get your Messaging Service SID from Twilio Console
2. Set in Supabase:
   - `USE_DIRECT_NUMBER` = `false`
   - `TWILIO_MESSAGING_SERVICE_SID` = `your-service-sid`

## Verification

After setting the environment variable:

1. The function health check should show `"ready": true`
2. Creating a new appointment should trigger SMS notifications
3. Check Twilio console to see sent messages
4. Check `notifications` table in database for records


