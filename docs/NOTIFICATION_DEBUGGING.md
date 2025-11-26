# Twilio SMS Notification Debugging Guide

## Overview

This guide helps you diagnose and fix issues with Twilio SMS notifications when appointments are created.

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

## Common Issues & Solutions

### Issue 1: Notifications Not Triggered

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
1. Check `send-sms` function logs:
   ```bash
   supabase functions logs send-sms
   ```
2. Verify Twilio credentials in Supabase dashboard:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
   - `USE_DIRECT_NUMBER` (true/false)
3. Test `send-sms` function directly (see Testing section)

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

- [ ] Edge functions are deployed
- [ ] Environment variables are set correctly
- [ ] Twilio credentials are valid
- [ ] Consumers exist in `notify_requests` table
- [ ] Consumer phone numbers are in E.164 format (+1234567890)
- [ ] Slot time matches consumer's `time_range` preference
- [ ] Merchant timezone is set correctly
- [ ] Browser console shows notification trigger
- [ ] Function logs show execution
- [ ] Twilio console shows sent messages

## Next Steps

If notifications still don't work after following this guide:

1. Check Supabase Edge Function logs for detailed error messages
2. Verify Twilio account has sufficient credits
3. Check Twilio phone number is verified (for trial accounts)
4. Verify RLS policies allow function access to data
5. Check network connectivity from edge functions to Twilio API


