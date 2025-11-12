# Environment Variables

This document lists all environment variables used in the Quick Booking Now application.

## Frontend Environment Variables (Vite)

These variables are prefixed with `VITE_` and are exposed to the client-side code. They are defined in `.env` or `.env.local` files.

### `VITE_SUPABASE_URL`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase project URL
- **Example**: `https://xxxxxxxxxxxxx.supabase.co`
- **Usage**: Frontend Supabase client initialization

### `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase anon/public key
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Usage**: Frontend Supabase client authentication

### `VITE_SUPABASE_PROJECT_ID`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase project ID
- **Example**: `mpgidpbffohjnyajgbdi`
- **Usage**: Project identification (optional, for some features)

## Backend Server Environment Variables (Node/Express)

These variables are set in the `server/.env` file for local development, or in your deployment platform (Vercel, Railway, Render, etc.) for production.

### Server Configuration

#### `PORT`
- **Type**: Number
- **Required**: No (defaults to 3001)
- **Purpose**: Port number for the server
- **Example**: `3001`
- **Usage**: Server listens on this port
- **Location**: `server/.env` file

#### `NODE_ENV`
- **Type**: String
- **Required**: No (defaults to development)
- **Purpose**: Node environment (development, production)
- **Example**: `production`
- **Usage**: Controls server behavior and error messages
- **Location**: `server/.env` file

#### `SUPABASE_URL`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase project URL
- **Example**: `https://xxxxxxxxxxxxx.supabase.co`
- **Usage**: Server connects to Supabase database
- **Location**: `server/.env` file

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase service role key (bypasses RLS)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Usage**: Server-side mutations, admin operations
- **Security**: Keep secret, never expose to client
- **Location**: `server/.env` file

### Twilio Configuration

#### `TWILIO_ACCOUNT_SID`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio account SID
- **Example**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: Twilio API authentication, signature verification
- **Location**: Server `.env` file

#### `TWILIO_AUTH_TOKEN`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio auth token
- **Example**: `your_auth_token_here`
- **Usage**: Twilio API authentication, signature verification
- **Security**: Keep secret, never expose to client
- **Location**: Server `.env` file

#### `TWILIO_PHONE_NUMBER`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio phone number (E.164 format)
- **Example**: `+1234567890`
- **Usage**: SMS sending, webhook handling
- **Location**: Server `.env` file

#### `TWILIO_WEBHOOK_URL`
- **Type**: String
- **Required**: Yes (for production)
- **Purpose**: Backend server URL for Twilio webhooks
- **Example**: `https://your-domain.com/webhooks/twilio-sms`
- **Usage**: Configure in Twilio Console for SMS webhooks
- **Location**: Server `.env` file

#### `TWILIO_MESSAGING_SERVICE_SID`
- **Type**: String
- **Required**: No (optional, if using messaging service)
- **Purpose**: Twilio messaging service SID
- **Example**: `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: SMS sending via messaging service (alternative to direct number)
- **Location**: Server `.env` file (if using messaging service)

### OpenAI Configuration

#### `OPENAI_API_KEY`
- **Type**: String
- **Required**: Yes (for SMS parsing)
- **Purpose**: OpenAI API key
- **Example**: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: Natural language parsing for SMS intake
- **Security**: Keep secret, never expose to client
- **Location**: `server/.env` file

#### `FRONTEND_URL`
- **Type**: String
- **Required**: No (optional, for OAuth callbacks)
- **Purpose**: Frontend application URL
- **Example**: `http://localhost:8080` (development) or `https://your-domain.com` (production)
- **Usage**: OAuth callback redirects, CORS configuration
- **Location**: `server/.env` file

## Backend Edge Functions Environment Variables (Supabase Edge Functions)

These variables are set in the Supabase Dashboard under Settings > Edge Functions > Secrets. They are not exposed to the client-side code.

### Supabase Configuration

#### `SUPABASE_URL`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase project URL
- **Example**: `https://xxxxxxxxxxxxx.supabase.co`
- **Usage**: Edge Functions connect to Supabase
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: String
- **Required**: Yes
- **Purpose**: Supabase service role key (bypasses RLS)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Usage**: Server-side mutations, admin operations
- **Security**: Keep secret, never expose to client
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

#### `SUPABASE_ANON_KEY`
- **Type**: String
- **Required**: Yes (for some functions)
- **Purpose**: Supabase anon/public key
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Usage**: Public API access, client authentication
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

### Twilio Configuration (Edge Functions)

#### `TWILIO_ACCOUNT_SID`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio account SID
- **Example**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: Twilio API authentication
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

#### `TWILIO_AUTH_TOKEN`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio auth token
- **Example**: `your_auth_token_here`
- **Usage**: Twilio API authentication
- **Security**: Keep secret, never expose to client
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

#### `TWILIO_PHONE_NUMBER`
- **Type**: String
- **Required**: Yes
- **Purpose**: Twilio phone number (E.164 format)
- **Example**: `+1234567890`
- **Usage**: SMS sending, webhook handling
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

#### `TWILIO_MESSAGING_SERVICE_SID`
- **Type**: String
- **Required**: No (optional, if using messaging service)
- **Purpose**: Twilio messaging service SID
- **Example**: `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usage**: SMS sending via messaging service (alternative to direct number)
- **Location**: Supabase Dashboard > Settings > Edge Functions > Secrets

### Google Calendar OAuth

#### `GOOGLE_OAUTH_CLIENT_ID`
- **Type**: String
- **Required**: Yes (for calendar integration)
- **Purpose**: Google OAuth client ID
- **Example**: `xxxxxxxxxxxxxxxx.apps.googleusercontent.com`
- **Usage**: Google Calendar OAuth flow

#### `GOOGLE_OAUTH_CLIENT_SECRET`
- **Type**: String
- **Required**: Yes (for calendar integration)
- **Purpose**: Google OAuth client secret
- **Example**: `GOCSPX-xxxxxxxxxxxxxxxx`
- **Usage**: Google Calendar OAuth flow
- **Security**: Keep secret, never expose to client

#### `CALENDAR_ENCRYPTION_KEY`
- **Type**: String
- **Required**: Yes (for calendar integration)
- **Purpose**: Encryption key for calendar credentials
- **Example**: `your_32_character_encryption_key_here`
- **Usage**: Encrypt/decrypt Google Calendar OAuth tokens
- **Security**: Keep secret, use strong random key

### SMS Intake (Optional)

#### `INTAKE_SECRET`
- **Type**: String
- **Required**: No (optional, for HMAC validation)
- **Purpose**: Secret key for HMAC signature validation
- **Example**: `your_secret_key_here`
- **Usage**: Validate API requests to intake endpoints
- **Security**: Keep secret, use strong random key

#### `TZ_FALLBACK`
- **Type**: String
- **Required**: No (optional, defaults to America/New_York)
- **Purpose**: Fallback timezone for SMS parsing
- **Example**: `America/New_York`
- **Usage**: Default timezone when merchant timezone is not set

### Frontend URL (Optional)

#### `FRONTEND_URL`
- **Type**: String
- **Required**: No (optional, for OAuth callbacks)
- **Purpose**: Frontend application URL
- **Example**: `https://quick-booking-now.example.com`
- **Usage**: OAuth callback redirects, CORS configuration

## Local Development Setup

### Frontend

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the frontend variables:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
   VITE_SUPABASE_PROJECT_ID=your_project_id
   ```

### Backend Server

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Fill in the backend variables:
   ```env
   PORT=3001
   NODE_ENV=development
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   TWILIO_WEBHOOK_URL=http://localhost:3001/webhooks/twilio-sms
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

### Edge Functions (Optional)

Set backend secrets in Supabase Dashboard:
- Go to Settings > Edge Functions > Secrets
- Add secrets for Edge Functions (auth, notifications, calendar)

## Production Deployment

### Frontend
- Set environment variables in your hosting platform (Vercel, Netlify, etc.)
- Use `.env.example` as a template
- Never commit `.env` files to git

### Backend
- Set secrets in Supabase Dashboard
- Use strong, random keys for sensitive variables
- Rotate keys periodically
- Monitor usage and costs

## Security Best Practices

1. **Never commit secrets**: Use `.gitignore` to exclude `.env` files
2. **Use strong keys**: Generate random, long keys for sensitive variables
3. **Rotate keys**: Periodically rotate API keys and secrets
4. **Limit access**: Only grant access to necessary team members
5. **Monitor usage**: Track API usage and costs
6. **Use environment-specific keys**: Different keys for dev/staging/prod

## Validation

### Required Variables
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OPENAI_API_KEY`

### Optional Variables
- `TWILIO_MESSAGING_SERVICE_SID` (if using messaging service)
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDAR_ENCRYPTION_KEY` (if using calendar integration)
- `INTAKE_SECRET`, `TZ_FALLBACK`, `FRONTEND_URL` (optional configuration)

## Troubleshooting

### Missing Variables
- Check `.env` file exists and contains all required variables
- Verify Supabase secrets are set in Dashboard
- Check environment variable names match exactly (case-sensitive)

### Invalid Values
- Verify URLs are correct and accessible
- Check API keys are valid and not expired
- Ensure phone numbers are in E.164 format

### Environment-Specific Issues
- Use different keys for dev/staging/prod
- Check CORS settings match your frontend URL
- Verify webhook URLs are correct for your environment

