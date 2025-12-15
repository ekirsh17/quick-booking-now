# Last-Minute Booking Notification System

A full-stack application that helps businesses notify customers about last-minute openings and handle bookings efficiently.

## 🎯 Project Overview

This system allows businesses to:
- Post last-minute availability slots
- Notify interested customers via SMS
- Manage bookings with automatic hold timers
- Track analytics and performance

Customers can:
- Request notifications for specific time ranges
- Claim available slots (with 3-minute hold)
- Complete bookings (native or redirect to external booking system)
- Receive SMS confirmations

## 🏗️ Architecture

### Frontend
- **React** + **TypeScript** + **Vite** for fast development
- **Tailwind CSS** + **shadcn-ui** for beautiful, responsive UI
- **React Router** for navigation
- **Supabase Client** for real-time updates

### Backend
- **Database**: Supabase (PostgreSQL)
- **SMS Intake API**: Node/Express server (for Twilio → OpenAI → Supabase flow)
- **Other APIs**: Supabase Edge Functions (Deno runtime) for auth, notifications, calendar
- **Row Level Security (RLS)** for data protection
- **Twilio** for SMS notifications
- **OpenAI** for natural language SMS parsing
- **Real-time subscriptions** for live updates

### Key Features
- **Phone-only authentication** (SMS OTP) for both merchants and consumers
- **Race condition handling** for simultaneous booking attempts
- **3-minute hold timer** to prevent double-booking
- **Real-time slot updates** using Supabase subscriptions
- **QR code generation** for easy customer onboarding

## 📦 Technologies

- **Frontend**: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- **Backend**: Supabase (Database, Auth, Edge Functions, Realtime)
- **SMS**: Twilio
- **AI**: OpenAI (for SMS parsing)
- **Payment** (planned): Stripe

## 🚀 Quick Start

### Prerequisites
- Node.js 20 ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Package manager (npm, pnpm, or yarn)
- Twilio account (for SMS)
- Supabase project
- OpenAI account (for SMS parsing)

### Local Development

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
pnpm install
# or: npm install

# Start development server
pnpm dev
# or: npm run dev
```

The app will be available at `http://localhost:8080`

See [docs/README_SETUP.md](docs/README_SETUP.md) for detailed setup instructions.

## 🔧 Environment Variables

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for complete environment variable documentation.

### Frontend Variables (Vite)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the actual values (see `.env.example` for structure):
   - Get Supabase keys from: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/api
   - Get Stripe key from: https://dashboard.stripe.com/apikeys
   - Get PayPal client ID from: https://developer.paypal.com/dashboard/applications

### Backend Server (Node/Express)

1. Copy `server/.env.example` to `server/.env`:
   ```bash
   cp server/.env.example server/.env
   ```

2. Fill in the actual values (see `server/.env.example` for structure):
   - Get Supabase service role key from: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/api
   - Get Twilio credentials from: https://console.twilio.com/
   - Get OpenAI API key from: https://platform.openai.com/api-keys
   - Get Stripe keys from: https://dashboard.stripe.com/apikeys
   - Get PayPal credentials from: https://developer.paypal.com/dashboard/applications

**Note**: The validation script will run automatically before `dev` and `build` commands to check for missing or placeholder values.

See [server/README.md](server/README.md) for detailed setup instructions.

### Backend Edge Functions (Supabase Edge Functions)

**Important**: Edge Functions use Supabase Dashboard secrets, NOT `.env` files.

Configure these secrets in your Supabase Dashboard:
- Go to: https://supabase.com/dashboard/project/gawcuwlmvcveddqjjqxc/settings/functions/secrets
- **Quick Setup**: See [docs/EDGE_FUNCTIONS_SETUP.md](docs/EDGE_FUNCTIONS_SETUP.md) for exact values to copy/paste
- **Complete Reference**: See [docs/EDGE_FUNCTIONS_ENV_VARS.md](docs/EDGE_FUNCTIONS_ENV_VARS.md) for full documentation

Key secrets include:
- `SUPABASE_URL` - Supabase project URL (usually auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_ANON_KEY` - Supabase anon key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Twilio credentials
- `OPENAI_API_KEY` - For SMS parsing
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` - For PayPal webhooks
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDAR_ENCRYPTION_KEY` - For calendar integration
- `SLOT_LINK_SIGNING_SECRET` - For booking link signing (generate with `openssl rand -hex 32`)
- `FRONTEND_URL` - Frontend URL for OAuth callbacks

## 📱 SMS Integration

### Twilio Setup

1. **Create Twilio Account**: [Sign up at Twilio](https://www.twilio.com/try-twilio)
2. **Get Phone Number**: Purchase a phone number with SMS capabilities
3. **Configure Secrets**: Add your Twilio credentials to Supabase secrets
4. **Enable Webhook** (for SMS replies - optional):
   - Go to Twilio Console → Phone Numbers → Manage → Active Numbers
   - Select your phone number
   - Under "Messaging Configuration", set webhook URL:
     ```
     https://<project-id>.supabase.co/functions/v1/handle-sms-reply
     ```
   - Method: `HTTP POST`
   - Save changes

### SMS Reply Handling

The `handle-sms-reply` edge function allows merchants to approve bookings via SMS:

**How it works:**
1. Merchant receives SMS notification about new booking request
2. Merchant replies with "CONFIRM" or "APPROVE"
3. Edge function updates booking status to confirmed
4. Customer receives confirmation SMS

**Setup:**
- Edge function: `supabase/functions/handle-sms-reply/index.ts`
- Deploy edge function: `supabase functions deploy handle-sms-reply`
- Configure webhook URL in Twilio (see above)

**Testing:**
1. Create a slot with "Require Manual Confirmation" enabled
2. Consumer claims the slot
3. Merchant receives SMS notification
4. Merchant replies "CONFIRM" to their SMS
5. Slot status updates to "booked"
6. Consumer receives confirmation

## 🗄️ Database Schema

### Tables

#### `profiles` (Merchant data)
- `id` - User ID (UUID, primary key)
- `business_name` - Business name
- `phone` - Phone number (E.164 format)
- `address` - Business address
- `booking_url` - External booking system URL (optional)
- `require_confirmation` - Boolean, require manual approval
- `use_booking_system` - Boolean, redirect to external booking
- `avg_appointment_value` - Numeric, for revenue calculations

#### `consumers` (Customer data)
- `id` - UUID, primary key
- `user_id` - UUID, links to auth.users (nullable)
- `name` - Customer name
- `phone` - Phone number (E.164 format)
- `saved_info` - Boolean, opt-in for saving data

#### `slots` (Availability slots)
- `id` - UUID, primary key
- `merchant_id` - UUID, links to profiles
- `start_time` - Timestamp
- `end_time` - Timestamp
- `duration_minutes` - Integer
- `status` - Text ('open', 'held', 'booked', 'pending_confirmation')
- `appointment_name` - Text, optional description
- `held_until` - Timestamp, 3-minute hold expiration
- `booked_by_consumer_id` - UUID, links to consumers
- `booked_by_name` - Text
- `consumer_phone` - Text

#### `notify_requests` (Notification preferences)
- `id` - UUID, primary key
- `merchant_id` - UUID, links to profiles
- `consumer_id` - UUID, links to consumers
- `time_range` - Text ('today', 'next-few-days', 'custom')
- `created_at` - Timestamp

#### `notifications` (SMS log)
- `id` - UUID, primary key
- `merchant_id` - UUID
- `consumer_id` - UUID
- `slot_id` - UUID
- `status` - Text ('sent', 'failed', 'delivered')
- `sent_at` - Timestamp

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:
- **Merchants**: Can only view/modify their own data
- **Consumers**: Can only view their own bookings/requests
- **Slots**: Anyone can view available slots; only merchants can create/modify
- **Public endpoints**: Notification requests and slot claiming are public

## 🔌 API Endpoints

### Backend Server (Node/Express)

#### `POST /webhooks/twilio-sms`
**Purpose**: Receive SMS webhook from Twilio, parse with OpenAI, create opening in Supabase
**Method**: POST
**Body**: Twilio webhook format (form-encoded)
**Flow**: Twilio SMS → OpenAI API → Supabase Database
**Status**: ⚠️ TODO: Implementation pending (scaffolded)

#### `GET /api/health`
**Purpose**: Health check endpoint
**Method**: GET
**Response**: JSON with health status of database, Twilio, OpenAI, and server
**Status**: ✅ Implemented

**Start server:**
```sh
cd server
npm install
npm run dev
```

### Edge Functions (Supabase)

#### `send-sms`
**Purpose**: Send SMS notifications via Twilio
**Endpoint**: `/functions/v1/send-sms`
**Method**: POST
**Body**:
```json
{
  "to": "+1234567890",
  "message": "Your message here"
}
```

#### `notify-consumers`
**Purpose**: Notify all matching consumers when a slot is created
**Endpoint**: `/functions/v1/notify-consumers`
**Method**: POST
**Body**:
```json
{
  "slotId": "uuid-here",
  "merchantId": "uuid-here"
}
```

#### `handle-sms-reply`
**Purpose**: Handle incoming SMS replies for booking confirmation
**Endpoint**: `/functions/v1/handle-sms-reply` (webhook from Twilio)
**Method**: POST
**Body**: Standard Twilio webhook payload

**Deploy edge functions:**
```sh
supabase functions deploy
```

See [docs/WEBHOOKS.md](docs/WEBHOOKS.md) for webhook configuration.
See [server/README.md](server/README.md) for backend server setup.

## 🎨 UI Components

This project uses **shadcn-ui** components with custom styling:
- Components: `src/components/ui/`
- Layouts: `src/components/merchant/` and `src/components/consumer/`
- Design system: `src/index.css` and `tailwind.config.ts`

## 📍 Routes

### Consumer Routes (Public)
- `/` - Landing page
- `/notify/:businessId` - Request notification form
- `/claim/:slotId` - Claim available slot
- `/booking-confirmed/:slotId` - Confirmation page
- `/my-bookings` - View bookings (auth required)

### Merchant Routes (Protected)
- `/merchant/login` - Phone/SMS authentication
- `/merchant/dashboard` - View slots and bookings
- `/merchant/add-availability` - Create new slots
- `/merchant/analytics` - Performance metrics
- `/merchant/settings` - Business profile and preferences

## 🧪 Testing

### End-to-End Testing Checklist

#### Consumer Flow
- [ ] Request notification via QR code
- [ ] Receive SMS when slot is posted
- [ ] Claim slot within 3 minutes
- [ ] Complete booking (native or external)
- [ ] Receive booking confirmation SMS
- [ ] View bookings in "My Bookings"

#### Merchant Flow
- [ ] Sign up with phone number
- [ ] Verify SMS OTP code
- [ ] Add business information
- [ ] Download QR code
- [ ] Create availability slot
- [ ] View notified consumers
- [ ] Approve/reject booking (if manual confirmation enabled)
- [ ] View analytics

#### Edge Cases
- [ ] Two users claiming same slot (race condition)
- [ ] Slot hold timer expiration (3 minutes)
- [ ] Invalid phone numbers
- [ ] SMS delivery failures
- [ ] Network interruptions
- [ ] External booking system redirect

### Developer Tools

**Admin Mode** (for testing):
- Toggle in UI (dev mode only by default)
- Enabled via `AdminContext`
- Allows viewing both merchant and consumer flows
- Access: `localStorage.setItem('adminMode', 'true')`

**Developer Tools Page** (`/tools`):
- Test SMS parsing
- Health check
- Quick links to documentation
- Access: Available in development mode or enable via `localStorage.setItem('devTools', 'true')`

## 🚢 Deployment

### Frontend Deployment

1. Build for production:
```sh
pnpm build
# or: npm run build
```

2. Deploy to your hosting provider:
   - [Vercel](https://vercel.com)
   - [Netlify](https://netlify.com)
   - [Cloudflare Pages](https://pages.cloudflare.com)
   - Or any static hosting service

3. Set environment variables in your hosting platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

### Backend Server Deployment

1. Deploy Node/Express backend server:
   - **Vercel**: Connect GitHub repo, set environment variables, deploy
   - **Railway**: See [docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md) for complete setup guide
   - **Render**: Create Web Service, connect GitHub repo, set environment variables
   - See [server/README.md](server/README.md) for detailed deployment instructions

2. Set environment variables in deployment platform:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `TWILIO_WEBHOOK_URL` (your deployed backend URL)
   - `OPENAI_API_KEY`

3. Update Twilio webhook URL:
   - Go to Twilio Console → Phone Numbers → Manage → Active Numbers
   - Set webhook URL to: `https://your-domain.com/webhooks/twilio-sms`
   - Method: `HTTP POST`

### Edge Functions Deployment

1. Deploy edge functions:
```sh
supabase functions deploy
```

2. Run database migrations:
```sh
supabase db push
```

3. Set secrets in Supabase Dashboard:
   - Go to Settings > Edge Functions > Secrets
   - Add all required secrets (see [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md))

See [docs/README_SETUP.md](docs/README_SETUP.md) for detailed deployment instructions.

## 🔐 Security

### Best Practices Implemented
- ✅ Row Level Security (RLS) on all tables
- ✅ Phone number validation (E.164 format)
- ✅ SMS OTP authentication
- ✅ Real-time token refresh
- ✅ HTTPS-only communication
- ✅ Input sanitization with Zod schemas
- ✅ No sensitive data in client code

### Production Checklist
- [ ] All Supabase secrets configured
- [ ] Twilio webhook configured
- [ ] RLS policies tested
- [ ] Phone numbers in E.164 format
- [ ] Error logging enabled
- [ ] Rate limiting configured
- [ ] CORS properly set up

## 📊 Analytics & Monitoring

### Built-in Analytics
- Total slots created
- Slots booked (fill rate)
- Notification sent/delivered
- Peak booking times
- Revenue estimates

### External Tools (Optional)
- **Sentry**: Error tracking
- **UptimeRobot**: Uptime monitoring
- **Google Analytics**: User behavior

## 🛣️ Roadmap

### Phase 1: Core Features ✅
- [x] Phone-only authentication
- [x] QR code generation
- [x] SMS notifications
- [x] Slot claiming with hold timer
- [x] Real-time updates

### Phase 2: Consumer Experience (In Progress)
- [ ] "My Bookings" page
- [ ] Consumer account settings
- [ ] Calendar export (.ics) validation

### Phase 3: Merchant Features
- [ ] Enhanced analytics dashboard
- [ ] Bulk slot creation
- [ ] Business profile enhancements

### Phase 4: Monetization
- [ ] Stripe integration
- [ ] Subscription plans
- [ ] Metered billing for SMS

### Phase 5: Advanced Features
- [ ] Multi-location support
- [ ] Team member accounts
- [ ] WhatsApp integration
- [ ] Custom branding

## 🐛 Troubleshooting

### SMS Not Sending
1. Check Twilio credentials in Supabase secrets
2. Verify phone numbers in E.164 format (+1234567890)
3. Check Twilio balance and phone number capabilities
4. Review edge function logs in Supabase Dashboard (Edge Functions > Logs)

### Authentication Issues

**Sign In/Sign Up Flow Not Working?**
- If you see `"TWILIO_MESSAGING_SERVICE_SID not configured"` error, see [FIX_SIGN_IN_SIGN_UP_FLOW.md](docs/FIX_SIGN_IN_SIGN_UP_FLOW.md)
- This is usually caused by missing `USE_DIRECT_NUMBER` environment variable in Supabase Edge Functions

**Other Authentication Issues:**
1. Ensure phone numbers include country code
2. Check Supabase auth settings (auto-confirm enabled)
3. Verify OTP code is 6 digits
4. Check for rate limiting on OTP requests
5. Review edge function logs: `generate-otp` and `verify-otp` in Supabase Dashboard

### Real-time Updates Not Working
1. Check browser console for WebSocket errors
2. Verify RLS policies allow SELECT on tables
3. Ensure Supabase realtime is enabled for tables
4. Check network connectivity

### Database Access Denied
1. Review RLS policies in Supabase dashboard
2. Ensure user is authenticated
3. Check that user ID matches policy conditions
4. Run Supabase linter: `supabase db lint`

## 📞 Support

- **Documentation**: See [docs/](docs/) directory
  - [Architecture](docs/ARCHITECTURE.md)
  - [Environment Variables](docs/ENVIRONMENT.md)
  - [Webhooks](docs/WEBHOOKS.md)
  - [Setup Guide](docs/README_SETUP.md)
- **Issues**: Create an issue in this repository

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

Built with:
- [Supabase](https://supabase.com) - Backend infrastructure
- [Twilio](https://www.twilio.com) - SMS notifications
- [OpenAI](https://openai.com) - AI-powered SMS parsing
- [shadcn-ui](https://ui.shadcn.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [React](https://react.dev) - UI framework
- [Vite](https://vitejs.dev) - Build tool

---

## 📚 Additional Resources

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Environment Variables](docs/ENVIRONMENT.md)
- [Webhooks Configuration](docs/WEBHOOKS.md)
- [Setup Guide](docs/README_SETUP.md)
