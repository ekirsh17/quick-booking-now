# Backend Server (Node/Express)

This directory contains the Node/Express backend server for handling SMS intake from Twilio.

## Overview

The backend server handles:
- **Twilio SMS Webhooks**: Receives SMS from merchants, verifies Twilio signature
- **OpenAI Integration**: Parses natural language SMS into structured opening data
- **Supabase Integration**: Writes openings to Supabase database
- **Health Check**: Simple health check endpoint

## Architecture

```
Twilio SMS → Node/Express Server → OpenAI API → Supabase Database
```

### Flow

1. **Twilio sends SMS webhook** to `/webhooks/twilio-sms`
2. **Server verifies Twilio signature** to ensure request is from Twilio
3. **Server extracts SMS text** and merchant phone number
4. **Server looks up merchant** in Supabase by phone number
5. **Server calls OpenAI API** to parse SMS into structured opening data
6. **Server creates opening** in Supabase database
7. **Server sends confirmation SMS** to merchant (via Twilio)
8. **Server notifies consumers** if applicable (via Supabase Edge Function)

## Setup

### Prerequisites

- Node.js 20
- npm or pnpm
- Supabase account
- Twilio account
- OpenAI account

### Installation

```bash
cd server
npm install
```

### Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the actual values in `.env`:
   - See `.env.example` for the complete structure with comments
   - Get Supabase service role key from: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/api
   - Get Twilio credentials from: https://console.twilio.com/
   - Get OpenAI API key from: https://platform.openai.com/api-keys
   - Get Stripe keys from: https://dashboard.stripe.com/apikeys
   - Get PayPal credentials from: https://developer.paypal.com/dashboard/applications

3. Validate your environment variables:
   ```bash
   npm run validate:env
   ```

**Note**: The validation script runs automatically before `dev`, `build`, and `start` commands.

### Database Placeholder IDs (Replace in Supabase)

The following placeholder IDs must be replaced in the `plans` table:

| Column | Starter Plan | Pro Plan | Where to Get |
|--------|--------------|----------|--------------|
| `stripe_price_id` | `STRIPE_PRICE_ID_STARTER` | `STRIPE_PRICE_ID_PRO` | Stripe Dashboard > Products > Price ID |
| `stripe_product_id` | `STRIPE_PRODUCT_ID_STARTER` | `STRIPE_PRODUCT_ID_PRO` | Stripe Dashboard > Products > Product ID |
| `paypal_plan_id` | `PAYPAL_PLAN_ID_STARTER` | `PAYPAL_PLAN_ID_PRO` | PayPal Developer > Subscriptions > Plan ID |

```sql
-- Example: Update Starter plan with real Stripe IDs
UPDATE plans SET 
  stripe_price_id = 'price_1234567890',
  stripe_product_id = 'prod_1234567890',
  paypal_plan_id = 'P-1234567890'
WHERE id = 'starter';
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### POST /webhooks/twilio-sms

Receives SMS webhook from Twilio.

**Request**: Twilio webhook format (form-encoded)
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

### GET /api/health

Health check endpoint.

**Response**: JSON
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00Z",
  "database": true,
  "twilio": true,
  "openai": true
}
```

## TODO

- [ ] Implement Twilio signature verification
- [ ] Implement OpenAI SMS parsing
- [ ] Implement Supabase opening creation
- [ ] Implement confirmation SMS sending
- [ ] Add error handling and logging
- [ ] Add tests
- [ ] Add rate limiting
- [ ] Add request validation
- [ ] Add monitoring and alerting

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Set environment variables in Vercel dashboard

### Railway

1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render

1. Create new Web Service
2. Connect GitHub repository
3. Set environment variables in Render dashboard
4. Deploy automatically on push

## Security

- **Twilio Signature Verification**: All webhook requests must be verified using Twilio signature
- **Environment Variables**: All secrets stored in environment variables
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Input Validation**: Validate all input data
- **Error Handling**: Don't expose sensitive information in error messages

## Monitoring

- **Health Checks**: Monitor `/api/health` endpoint
- **Error Logging**: Log all errors to monitoring service
- **Metrics**: Track API usage, response times, error rates
- **Alerts**: Set up alerts for critical errors

## Testing

```bash
npm test
```

## Documentation

See `docs/WEBHOOKS.md` for detailed webhook documentation.

