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

### Backend (Lovable Cloud)
- **Supabase** (PostgreSQL database)
- **Row Level Security (RLS)** for data protection
- **Edge Functions** (Deno) for serverless logic
- **Twilio** for SMS notifications
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
- **Payment** (planned): Stripe
- **Hosting**: Lovable (automatic deployment)

## 🚀 Quick Start

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Twilio account (for SMS)
- Supabase project (automatically provided via Lovable Cloud)

### Local Development

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## 🔧 Environment Variables

The following environment variables are automatically configured via Lovable Cloud:

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=<your-project-id>
```

### Supabase Secrets (Edge Functions)

Configure these secrets in your Supabase project for edge functions:

- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number (E.164 format)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

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
- Already deployed automatically
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

## 🔌 Edge Functions

### `send-sms`
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

### `notify-consumers`
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

### `handle-sms-reply`
**Purpose**: Handle incoming SMS replies for booking confirmation
**Endpoint**: `/functions/v1/handle-sms-reply` (webhook from Twilio)
**Method**: POST
**Body**: Standard Twilio webhook payload

**All edge functions are automatically deployed when you push changes.**

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

## 🚢 Deployment

### Via Lovable (Recommended)
1. Open your project in Lovable
2. Click **Publish** button (top right)
3. Changes are automatically deployed
4. Custom domain: Project > Settings > Domains

### Manual Deployment
```sh
# Build production bundle
npm run build

# Deploy to your hosting provider
# (Vercel, Netlify, Cloudflare Pages, etc.)
```

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
4. Review edge function logs: Lovable > Backend > Edge Functions

### Authentication Issues
1. Ensure phone numbers include country code
2. Check Supabase auth settings (auto-confirm enabled)
3. Verify OTP code is 6 digits
4. Check for rate limiting on OTP requests

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

- **Documentation**: [Lovable Docs](https://docs.lovable.dev)
- **Community**: [Lovable Discord](https://discord.com/channels/1119885301872070706)
- **Issues**: Create an issue in this repository

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

Built with:
- [Lovable](https://lovable.dev) - Full-stack development platform
- [Supabase](https://supabase.com) - Backend infrastructure
- [Twilio](https://www.twilio.com) - SMS notifications
- [shadcn-ui](https://ui.shadcn.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling

---

**Project URL**: https://lovable.dev/projects/d568b2ce-5971-4172-9304-c87f47620155

**Live Demo**: https://quick-booking-now.lovable.app
