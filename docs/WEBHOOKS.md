# Webhooks Documentation

This document describes the webhook endpoints and configuration for Quick Booking Now.

## Twilio Webhooks

### Inbound SMS (Merchant Intake)

**Endpoint**: `POST /webhooks/twilio-sms` (Node/Express backend)

**Purpose**: Parse SMS messages from merchants to create openings

**Method**: POST

**Content-Type**: `application/x-www-form-urlencoded`

**Request Format**: Twilio webhook format
```
Body=2pm%20haircut&From=%2B1234567890&To=%2B0987654321&...
```

**Response**: JSON
```json
{
  "success": true,
  "opening": {
    "id": "uuid",
    "merchant_id": "uuid",
    "start_time": "2025-01-15T14:00:00Z",
    "end_time": "2025-01-15T14:30:00Z",
    "duration_minutes": 30,
    "appointment_name": "Haircut",
    "status": "open"
  }
}
```

**Configuration**:
1. Deploy Node/Express backend server (see `server/README.md`)
2. Get your backend server URL (e.g., `https://your-domain.com`)
3. Go to Twilio Console → Phone Numbers → Manage → Active Numbers
4. Select your phone number
5. Under "Messaging Configuration", set webhook URL:
   ```
   https://your-domain.com/webhooks/twilio-sms
   ```
6. Method: `HTTP POST`
7. Save changes

**Processing Flow**:
1. **Twilio sends SMS webhook** to `/webhooks/twilio-sms`
2. **Server verifies Twilio signature** to ensure request is from Twilio
3. **Server extracts SMS text** and merchant phone number
4. **Server looks up merchant** in Supabase by phone number
5. **Server calls OpenAI API** to parse SMS into structured opening data
6. **Server creates opening** in Supabase database
7. **Server sends confirmation SMS** to merchant (via Twilio)
8. **Server notifies consumers** if applicable (via Supabase Edge Function)

**Signature Verification**:
- Twilio includes a signature in the `X-Twilio-Signature` header
- Server must verify this signature using Twilio Auth Token
- See `server/src/routes/twilio-sms.ts` for implementation (TODO)

### SMS Replies (Booking Confirmation)

**Endpoint**: `/functions/v1/handle-sms-reply`

**Purpose**: Handle incoming SMS replies for booking confirmation

**Method**: POST

**Content-Type**: `application/x-www-form-urlencoded`

**Request Format**: Twilio webhook format
```
Body=CONFIRM&From=%2B1234567890&To=%2B0987654321&...
```

**Response**: JSON
```json
{
  "success": true,
  "message": "Booking confirmed"
}
```

**Configuration**:
1. Go to Twilio Console → Phone Numbers → Manage → Active Numbers
2. Select your phone number
3. Under "Messaging Configuration", set webhook URL:
   ```
   https://<project-id>.supabase.co/functions/v1/handle-sms-reply
   ```
4. Method: `HTTP POST`
5. Save changes

**Processing**:
1. Receives SMS reply from merchant
2. Parses command ("CONFIRM", "APPROVE", etc.)
3. Updates booking status to confirmed
4. Sends confirmation SMS to consumer

### Status Callbacks

**Endpoint**: `/functions/v1/twilio-status-callback`

**Purpose**: Track SMS delivery status

**Method**: POST

**Content-Type**: `application/x-www-form-urlencoded`

**Request Format**: Twilio status callback format
```
MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&MessageStatus=delivered&...
```

**Response**: 200 OK

**Configuration**:
1. Set in `send-sms` Edge Function
2. Automatically included in Twilio API calls
3. No manual configuration needed

**Processing**:
1. Receives status updates from Twilio
2. Updates `notifications` table with delivery status
3. Logs status for analytics

## Google Calendar Webhooks (Future)

### Calendar Events

**Endpoint**: `/functions/v1/google-calendar-webhook` (not yet implemented)

**Purpose**: Sync calendar events from Google Calendar

**Method**: POST

**Configuration**:
1. Set up Google Calendar API webhook
2. Configure in Google Cloud Console
3. Verify webhook endpoint

**Processing**:
1. Receives calendar event updates
2. Syncs events to `slots` table
3. Updates slot status based on calendar events

## Webhook Security

### Twilio Webhooks

**Authentication**: 
- Twilio webhooks include signature validation
- Verify webhook signatures to ensure requests are from Twilio
- Use `X-Twilio-Signature` header for validation

**Validation**:
```typescript
// Example validation (implement in Edge Function)
const signature = req.headers.get('X-Twilio-Signature');
const url = req.url;
const params = await req.formData();
const isValid = validateTwilioSignature(signature, url, params);
```

### Google Calendar Webhooks

**Authentication**:
- OAuth 2.0 tokens
- Verify webhook signatures
- Use Google Cloud Pub/Sub for secure webhooks

## Testing Webhooks

### Local Development

1. Use ngrok or similar tool to expose local server:
   ```bash
   ngrok http 54321
   ```

2. Update Twilio webhook URL to ngrok URL:
   ```
   https://xxxx-xx-xx-xx-xx.ngrok.io/functions/v1/parse-sms-opening
   ```

3. Send test SMS to Twilio number
4. Check Edge Function logs in Supabase Dashboard

### Production Testing

1. Send test SMS to Twilio number
2. Check Edge Function logs in Supabase Dashboard
3. Verify database updates
4. Check SMS delivery status

## Webhook Monitoring

### Logging

- Edge Functions log all webhook requests
- Check Supabase Dashboard → Edge Functions → Logs
- Monitor for errors and failures

### Error Handling

- Webhooks should return 200 OK even on errors
- Log errors for debugging
- Send notifications for critical failures

### Rate Limiting

- Twilio webhooks are rate-limited by Twilio
- Implement rate limiting in Edge Functions
- Handle rate limit errors gracefully

## Troubleshooting

### Webhook Not Received

1. Check webhook URL is correct
2. Verify webhook is configured in Twilio/Google
3. Check firewall/network settings
4. Verify Edge Function is deployed

### Webhook Errors

1. Check Edge Function logs
2. Verify environment variables are set
3. Check database connections
4. Verify API credentials are valid

### Delivery Issues

1. Check Twilio status callbacks
2. Verify phone numbers are correct
3. Check SMS delivery logs
4. Monitor Twilio account status

## Best Practices

1. **Always validate webhooks**: Verify signatures and origin
2. **Handle errors gracefully**: Return 200 OK even on errors
3. **Log everything**: Log all webhook requests for debugging
4. **Monitor performance**: Track webhook response times
5. **Implement retries**: Retry failed webhook processing
6. **Rate limiting**: Implement rate limiting to prevent abuse
7. **Security**: Use HTTPS, validate signatures, limit access

## Webhook URLs by Environment

### Development
- Base URL: `http://localhost:54321`
- Webhook URL: `http://xxxx-xx-xx-xx-xx.ngrok.io/functions/v1/...`

### Staging
- Base URL: `https://<staging-project-id>.supabase.co`
- Webhook URL: `https://<staging-project-id>.supabase.co/functions/v1/...`

### Production
- Base URL: `https://<production-project-id>.supabase.co`
- Webhook URL: `https://<production-project-id>.supabase.co/functions/v1/...`

## Additional Resources

- [Twilio Webhook Documentation](https://www.twilio.com/docs/usage/webhooks)
- [Google Calendar API Webhooks](https://developers.google.com/calendar/api/guides/push)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

