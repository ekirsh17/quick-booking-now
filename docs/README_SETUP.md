# Setup Guide

This guide will help you set up the Quick Booking Now application for local development.

## Prerequisites

- **Node.js**: Version 20 (use `.nvmrc` or install manually)
- **Package Manager**: npm, pnpm, or yarn (pnpm recommended)
- **Supabase Account**: For database and edge functions
- **Twilio Account**: For SMS notifications
- **OpenAI Account**: For SMS parsing (optional, but recommended)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd quick-booking-now-1
```

### 2. Install Node.js Version

If using nvm:
```bash
nvm install
nvm use
```

Or install Node.js 20 manually from [nodejs.org](https://nodejs.org/).

### 3. Install Dependencies

```bash
pnpm install
```

Or with npm:
```bash
npm install
```

### 4. Set Up Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in the frontend environment variables in `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### 5. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Add them to `.env` file
4. Set up backend secrets in Supabase Dashboard:
   - Go to Settings > Edge Functions > Secrets
   - Add the following secrets:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_ANON_KEY`
     - `TWILIO_ACCOUNT_SID`
     - `TWILIO_AUTH_TOKEN`
     - `TWILIO_PHONE_NUMBER`
     - `TWILIO_MESSAGING_SERVICE_SID` (optional)
     - `OPENAI_API_KEY`
     - `GOOGLE_OAUTH_CLIENT_ID` (optional, for calendar integration)
     - `GOOGLE_OAUTH_CLIENT_SECRET` (optional, for calendar integration)
     - `CALENDAR_ENCRYPTION_KEY` (optional, for calendar integration)
     - `FRONTEND_URL` (optional, for OAuth callbacks)

### 6. Set Up Twilio

1. Create a Twilio account at [twilio.com](https://www.twilio.com)
2. Get your Account SID and Auth Token from the Console
3. Purchase a phone number with SMS capabilities
4. Add credentials to Supabase secrets
5. Configure webhooks in Twilio Console:
   - Go to Phone Numbers > Manage > Active Numbers
   - Select your phone number
   - Under "Messaging Configuration", set webhook URL:
     ```
     https://<project-id>.supabase.co/functions/v1/parse-sms-opening
     ```
   - Method: `HTTP POST`
   - Save changes

### 7. Set Up OpenAI

1. Create an OpenAI account at [openai.com](https://www.openai.com)
2. Get your API key from the Dashboard
3. Add to Supabase secrets as `OPENAI_API_KEY`

### 8. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <project-id>

# Run migrations
supabase db push
```

Or run migrations manually in Supabase Dashboard:
- Go to SQL Editor
- Run each migration file from `supabase/migrations/`

### 9. Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy parse-sms-opening
```

### 10. Start Development Server

```bash
pnpm dev
```

Or with npm:
```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking

### Project Structure

```
quick-booking-now-1/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom hooks
│   ├── contexts/          # React contexts
│   ├── integrations/      # External integrations
│   └── utils/             # Utility functions
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge Functions
│   └── migrations/        # Database migrations
├── docs/                  # Documentation
├── public/                # Static assets
└── .env.example           # Environment variables template
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with React hooks plugin
- **Prettier**: Not configured (optional)
- **Formatting**: Use ESLint auto-fix

### Testing

Currently, there are no automated tests. Manual testing is recommended:

1. **Merchant Flow**:
   - Sign up with phone number
   - Verify OTP code
   - Create business profile
   - Create availability slot
   - Test SMS intake (send SMS to Twilio number)

2. **Consumer Flow**:
   - Request notification via QR code
   - Receive SMS when slot is posted
   - Claim slot
   - Complete booking

3. **Edge Cases**:
   - Two users claiming same slot
   - Slot hold timer expiration
   - Invalid phone numbers
   - SMS delivery failures

## Troubleshooting

### Build Errors

1. Check Node.js version (should be 20):
   ```bash
   node --version
   ```

2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. Check TypeScript errors:
   ```bash
   pnpm typecheck
   ```

### Environment Variables

1. Verify `.env` file exists and contains all required variables
2. Check variable names match exactly (case-sensitive)
3. Verify Supabase secrets are set in Dashboard

### Supabase Connection

1. Check Supabase URL and keys are correct
2. Verify RLS policies allow access
3. Check Edge Functions are deployed

### Twilio Issues

1. Verify Twilio credentials are correct
2. Check phone number is in E.164 format
3. Verify webhook URL is correct
4. Check Twilio account balance

### OpenAI Issues

1. Verify API key is correct
2. Check API usage limits
3. Verify API key has access to GPT-4o model

## Production Deployment

### Frontend

1. Build for production:
   ```bash
   pnpm build
   ```

2. Deploy to hosting platform (Vercel, Netlify, etc.)

3. Set environment variables in hosting platform

### Backend

1. Deploy Edge Functions:
   ```bash
   supabase functions deploy
   ```

2. Run database migrations:
   ```bash
   supabase db push
   ```

3. Set secrets in Supabase Dashboard

### Environment Variables

1. Set frontend variables in hosting platform
2. Set backend secrets in Supabase Dashboard
3. Use production keys (not development keys)

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Twilio Documentation](https://www.twilio.com/docs)
- [OpenAI Documentation](https://platform.openai.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## Support

For issues or questions:
1. Check documentation in `docs/` directory
2. Review error logs in Supabase Dashboard
3. Check GitHub issues (if applicable)
4. Contact team members

