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

Create a `.env` file in the `server/` directory:

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_WEBHOOK_URL=https://your-domain.com/webhooks/twilio-sms

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Optional
FRONTEND_URL=http://localhost:8080
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

