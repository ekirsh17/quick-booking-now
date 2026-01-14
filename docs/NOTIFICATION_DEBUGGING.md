# Twilio SMS Notification Debugging Guide

## Overview

This guide helps you diagnose and fix issues with Twilio SMS notifications when appointments are created.

## Error Handling Architecture (Updated)

The notification system has been redesigned to separate critical errors (opening creation failures) from non-critical errors (notification failures). This ensures that:

- **Opening creation always succeeds** even if notifications fail
- **Error toasts only show** for actual opening save failures
- **Notification failures are logged** but don't block the user flow
- **Clear error messages** help diagnose configuration issues

### How It Works

1. **Opening Creation**: Handled separately from notifications. If this fails, an error toast is shown.
2. **Notification Triggering**: Uses `notifyConsumersSafely()` helper that never throws exceptions.
3. **Error Handling**: Notification errors are logged and shown as warnings, not errors.
4. **Configuration Validation**: Edge functions validate configuration at startup and return clear error messages.

## Notification Flow

1. **Appointment Creation** → Frontend creates slot in database
2. **Notification Trigger** → `notify-consumers` edge function is called
3. **Consumer Query** → Function queries `notify_requests` table for matching consumers
4. **SMS Sending** → For each consumer, `send-sms` edge function is called
5. **Twilio API** → SMS is sent via Twilio API

## Key Files

- **Frontend**: `src/pages/merchant/Openings.tsx` - Creates openings and triggers notifications
- **Notification Function**: `supabase/functions/notify-consumers/index.ts` - Queries consumers and triggers SMS
- **SMS Function**: `supabase/functions/send-sms/index.ts` - Sends SMS via Twilio API
- **SMS Slot Operations**: `supabase/functions/sms-slot-operations/index.ts` - Creates slots via SMS and triggers notifications

## Configuration Validation

### Using Health Check Function

The `health-check` edge function validates all required environment variables and returns a structured health status.

**Check configuration:**
```bash
# Via Supabase CLI
supabase functions invoke health-check

# Or via curl
curl -X POST https://your-project.supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Using validation script:**
```bash
# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ACCESS_TOKEN=your-access-token

# Run validation
node scripts/validate-edge-function-config.js

# Or with project ref
node scripts/validate-edge-function-config.js --project-ref your-project-ref
```

The health check returns:
- `status`: 'healthy', 'degraded', or 'unhealthy'
- `checks`: Detailed status of each configuration item
- `summary`: Count of required vs present configuration

### Common Configuration Errors

**Error: "TWILIO_MESSAGING_SERVICE_SID not configured"**
- **Solution**: Either set `USE_DIRECT_NUMBER=true` and provide `TWILIO_PHONE_NUMBER`, or set `TWILIO_MESSAGING_SERVICE_SID`

**Error: "FRONTEND_URL not set"**
- **Solution**: Set `FRONTEND_URL` in Supabase Dashboard > Edge Functions > Settings > Secrets
- **Format**: `https://your-domain.com` (no trailing slash)

**Error: "send-sms returned error"**
- **Check**: Run health-check function to see which Twilio credentials are missing
- **Verify**: All required Twilio credentials are set in Supabase Dashboard

## Common Issues & Solutions

### Issue 1: Opening Saves But Shows Error Toast

**Symptoms**: Opening is created successfully but error toast appears.

**Root Cause**: This was a bug where notification failures triggered error toasts. **This has been fixed.**

**New Behavior**: 
- Opening creation errors → Error toast (critical)
- Notification failures → Warning message, opening still saved (non-critical)

**If you still see this**: Check browser console for actual error. The error toast should only appear if opening creation itself fails.

### Issue 2: Notifications Not Triggered

**Symptoms**: Appointments are created but no SMS is sent.

**Possible Causes**:
1. `notify-consumers` function not being called
2. Function call failing silently
3. No consumers in `notify_requests` table
4. Consumers don't match time range filters

**Debugging Steps**:
1. Check browser console for errors when creating an appointment
2. Check Supabase Edge Function logs for `notify-consumers`
3. Verify consumers exist in `notify_requests` table:
   ```sql
   SELECT * FROM notify_requests WHERE merchant_id = 'your-merchant-id';
   ```
4. Check if consumers match the slot's time range (today, tomorrow, this_week, etc.)

### Issue 2: Function Call Fails

**Symptoms**: Error in console when creating appointment.

**Debugging Steps**:
1. Check browser console for detailed error messages
2. Verify edge function is deployed:
   ```bash
   supabase functions list
   ```
3. Check function logs:
   ```bash
   supabase functions logs notify-consumers
   ```
4. Verify environment variables are set in Supabase dashboard

### Issue 3: No Consumers to Notify

**Symptoms**: Appointment created successfully but no notifications sent (0 subscribers).

**Debugging Steps**:
1. Verify consumers exist:
   ```sql
   SELECT * FROM consumers WHERE id IN (
     SELECT consumer_id FROM notify_requests WHERE merchant_id = 'your-merchant-id'
   );
   ```
2. Check time range matching:
   - Slot date must match consumer's `time_range` preference
   - `time_range` can be: 'today', 'tomorrow', 'this_week', 'next_week', 'anytime'
3. Verify merchant timezone is set correctly in `profiles` table

### Issue 4: SMS Function Fails

**Symptoms**: `notify-consumers` runs but SMS not sent.

**Debugging Steps**:
1. **Check configuration first**:
   ```bash
   node scripts/validate-edge-function-config.js
   ```
   This will show exactly which configuration is missing.

2. **Check `send-sms` function logs**:
   ```bash
   supabase functions logs send-sms
   ```
   Look for clear error messages about missing configuration.

3. **Verify Twilio credentials in Supabase dashboard**:
   - `TWILIO_ACCOUNT_SID` (required)
   - `TWILIO_AUTH_TOKEN` (required)
   - `TWILIO_PHONE_NUMBER` (required if `USE_DIRECT_NUMBER=true`)
   - `TWILIO_MESSAGING_SERVICE_SID` (required if `USE_DIRECT_NUMBER=false`)
   - `USE_DIRECT_NUMBER` (true or false, must match above)

4. **Test `send-sms` function directly** (see Testing section)

**New Error Messages**: The `send-sms` function now returns clear error messages at startup if configuration is missing, making it easier to diagnose issues.

## Testing Steps

### Step 1: Verify Edge Functions Are Deployed

```bash
# List all functions
supabase functions list

# Should see:
# - notify-consumers
# - send-sms
```

### Step 2: Test Send-SMS Function Directly

```bash
# Test the send-sms function
curl -X POST https://your-project.supabase.co/functions/v1/send-sms \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Test message"
  }'
```

Or use the test script:
```bash
node scripts/test-send-sms.js
```

### Step 3: Test Notify-Consumers Function Directly

```bash
# First, create a test slot
# Then test notify-consumers
curl -X POST https://your-project.supabase.co/functions/v1/notify-consumers \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "your-slot-id",
    "merchantId": "your-merchant-id"
  }'
```

### Step 4: Create Test Consumer and Notify Request

```sql
-- Create a test consumer
INSERT INTO consumers (name, phone, saved_info)
VALUES ('Test User', '+1234567890', true)
RETURNING id;

-- Create a notify request for the consumer
INSERT INTO notify_requests (merchant_id, consumer_id, time_range)
VALUES (
  'your-merchant-id',
  'consumer-id-from-above',
  'anytime'  -- or 'today', 'tomorrow', etc.
);
```

### Step 5: Create Test Appointment

1. Go to the merchant dashboard
2. Create a new opening/appointment
3. Check browser console for logs
4. Check Supabase function logs
5. Verify SMS was sent in Twilio console

## Verification Methods

### 1. Browser Console Logs

When creating an appointment, you should see:
```
[Openings] Triggering notifications for new slot: { slotId: '...', merchantId: '...' }
[Openings] Notification response: { data: {...}, error: null }
[Openings] Successfully notified X consumer(s)
```

### 2. Supabase Function Logs

```bash
# Watch logs in real-time
supabase functions logs notify-consumers --follow

# Check send-sms logs
supabase functions logs send-sms --follow
```

### 3. Twilio Console

1. Go to https://console.twilio.com
2. Navigate to Messaging → Logs
3. Check for sent messages
4. Verify message status (queued, sent, delivered, failed)

### 4. Database Verification

```sql
-- Check if notifications were recorded
SELECT * FROM notifications 
WHERE slot_id = 'your-slot-id'
ORDER BY sent_at DESC;

-- Check notify_requests
SELECT nr.*, c.name, c.phone 
FROM notify_requests nr
JOIN consumers c ON c.id = nr.consumer_id
WHERE nr.merchant_id = 'your-merchant-id';
```

## Environment Variables Checklist

Ensure these are set in Supabase Dashboard → Settings → Edge Functions:

- `SUPABASE_URL` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (if using direct number)
- `TWILIO_MESSAGING_SERVICE_SID` (if using messaging service)
- `USE_DIRECT_NUMBER` (true or false)
- `FRONTEND_URL` (for booking links in SMS)

## Manual Test Script

See `scripts/test-notification-flow.js` for a complete end-to-end test script.

## Troubleshooting Checklist

### Pre-Deployment Checks
- [ ] Run `node scripts/validate-edge-function-config.js` - all required config present
- [ ] Deploy `health-check` function: `supabase functions deploy health-check`
- [ ] Test health-check: `supabase functions invoke health-check`

### Configuration
- [ ] Edge functions are deployed
- [ ] Environment variables are set correctly (use health-check to verify)
- [ ] Twilio credentials are valid
- [ ] `FRONTEND_URL` is set for booking links

### Data & Logic
- [ ] Consumers exist in `notify_requests` table
- [ ] Consumer phone numbers are in E.164 format (+1234567890)
- [ ] Slot time matches consumer's `time_range` preference (simplified UTC-based filtering)
- [ ] Merchant timezone is set correctly in `profiles` table (for display only)

### Runtime Verification
- [ ] Browser console shows notification trigger (no errors for opening creation)
- [ ] Function logs show execution (check both `notify-consumers` and `send-sms`)
- [ ] Twilio console shows sent messages
- [ ] Opening saves successfully even if notifications fail (new behavior)

## Error Handling Best Practices

### Frontend Error Handling

The frontend now uses `notifyConsumersSafely()` which:
- Never throws exceptions
- Always returns a status object
- Logs errors for debugging
- Doesn't block opening creation

**Example behavior:**
- Opening created successfully → Success toast
- Notifications sent → "X subscribers notified" message
- Notifications failed → "Opening published (notifications may be delayed)" warning
- Opening creation failed → Error toast (critical)

### Edge Function Error Handling

**`send-sms` function:**
- Validates configuration at startup
- Returns clear error messages for missing config
- Never throws unhandled exceptions

**`notify-consumers` function:**
- Simplified date filtering (UTC-based, no complex timezone calculations)
- Removed fallback Twilio logic (kept only in `send-sms`)
- Clear error messages for missing configuration

## Next Steps

If notifications still don't work after following this guide:

1. **Run health-check**: `node scripts/validate-edge-function-config.js`
2. Check Supabase Edge Function logs for detailed error messages
3. Verify Twilio account has sufficient credits
4. Check Twilio phone number is verified (for trial accounts)
5. Verify RLS policies allow function access to data
6. Check network connectivity from edge functions to Twilio API
7. Review browser console - notification errors should not block opening creation


