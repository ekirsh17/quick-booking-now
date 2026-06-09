# Webhooks Documentation

This document describes the webhook endpoints and configuration for Quick Booking Now.

## Twilio Webhooks

### Inbound SMS (Current Production Routing)

**Endpoint**: `POST /functions/v1/handle-sms-reply` (Supabase Edge Function)

**Purpose**: Handle SMS compliance replies (`STOP`/`START`) safely

**Method**: POST

**Content-Type**: `application/x-www-form-urlencoded`

**Request Format**: Twilio webhook format
```
Body=2pm%20haircut&From=%2B1234567890&To=%2B0987654321&...
```

**Response**: TwiML (XML)

**Configuration**:
1. Deploy `handle-sms-reply` edge function
3. Go to Twilio Console → Phone Numbers → Manage → Active Numbers
4. Select your phone number
5. Under "Messaging Configuration", set webhook URL:
   ```
   https://<project-id>.supabase.co/functions/v1/handle-sms-reply
   ```
6. Method: `HTTP POST`
7. Save changes

**Processing Flow**:
1. **Twilio sends SMS webhook** to `handle-sms-reply`
2. **Edge function validates Twilio signature**
3. `STOP` unsubscribes and `START` resubscribes
4. Merchant action-by-text commands remain disabled

**Toll-free START/STOP message count** (Advanced Opt-Out):

| Keyword | User receives | App TwiML reply |
|---------|---------------|-----------------|
| `STOP` | Carrier `NETWORK MSG` only | Empty (no duplicate) |
| `START` | Carrier `NETWORK MSG` + Messaging Service opt-in confirmation | Empty (no duplicate) |
| Other | Disabled-commands text only | One TwiML message |

For toll-free `START`, Twilio Advanced Opt-Out sends the welcome/opt-in text **before** the webhook runs. Set that copy in Twilio Console → Messaging → Services → your service → **Opt-Out** → **Opt-In** confirmation message:

```
You're re-subscribed to OpenAlert. If you're on a waitlist, we'll text you when openings are available. Reply STOP to unsubscribe.
```

Do not also return a TwiML `<Message>` for `START`/`HELP` (that duplicates Twilio Advanced Opt-Out). `handle-sms-reply` always returns empty TwiML for those keywords.

**If updated Twilio copy does not appear:** confirm `+18448203482` is in the **Sender Pool** of the Messaging Service where you edited Opt-Out Management (likely `Sole Proprietor A2P Messaging Service`). Check function logs for `messagingServiceSid=` on inbound — if it is `none`, the number may not be linked to that service.

**Signature Verification**:
- Twilio includes a signature in the `X-Twilio-Signature` header
- `handle-sms-reply` validates this signature using Twilio Auth Token
- Requests with invalid signatures are rejected

### Merchant SMS Intake (Parked)

**Endpoint**: `/functions/v1/parse-sms-opening`

**Purpose**: Legacy merchant text-to-create intake flow (parked for this phase)

**Method**: POST

**Content-Type**: `application/x-www-form-urlencoded`

**Request Format**: Twilio webhook format
```
Body=2pm%20haircut&From=%2B1234567890&To=%2B0987654321&...
```

**Response**: JSON
```json
{
  "success": false,
  "parked": true,
  "message": "Merchant SMS intake is parked for this phase and will be re-enabled later."
}
```

**Configuration**:
1. Keep `SMS_INTAKE_ENABLED` unset/false in production
2. Do not point Twilio inbound webhook at this endpoint
3. Re-enable only after explicit security review and rollout approval

**Processing**:
1. Endpoint returns parked response when disabled
2. No merchant opening/approval actions should run in production

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

2. Update Twilio webhook URL to ngrok URL (only for explicit local webhook tests):
   ```
   https://xxxx-xx-xx-xx-xx.ngrok.io/functions/v1/handle-sms-reply
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

