# Architecture Documentation

## Overview

Quick Booking Now is a full-stack application for managing last-minute booking notifications. The system consists of a React frontend, Node/Express backend for SMS intake, Supabase database, and integrations with Twilio for SMS and OpenAI for natural language parsing.

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **State Management**: TanStack Query (React Query)
- **Auth**: Supabase Auth (phone/SMS OTP)

### Backend
- **Database**: Supabase (PostgreSQL)
- **SMS Intake API**: Node/Express server (for Twilio → OpenAI → Supabase flow)
- **Other APIs**: Supabase Edge Functions (Deno runtime) for auth, notifications, calendar
- **Authentication**: Supabase Auth (phone/SMS OTP)
- **RLS**: Row Level Security enabled on all tables
- **Real-time**: Supabase Realtime subscriptions

### External Services
- **SMS**: Twilio
- **AI**: OpenAI API (for SMS parsing)
- **Calendar**: Google Calendar API (OAuth)

## Data Model

### Core Tables

#### `profiles` (Merchants)
- `id` (UUID, PK) - References auth.users
- `business_name` (TEXT)
- `phone` (TEXT, UNIQUE, E.164 format)
- `address` (TEXT)
- `booking_url` (TEXT, optional)
- `time_zone` (TEXT, IANA timezone)
- `require_confirmation` (BOOLEAN)
- `use_booking_system` (BOOLEAN)
- `avg_appointment_value` (DECIMAL)
- `default_opening_duration` (INTEGER, minutes)
- `saved_appointment_names` (TEXT[])
- `saved_durations` (INTEGER[])
- `working_hours` (JSONB)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `slots` (Availability Slots)
- `id` (UUID, PK)
- `merchant_id` (UUID, FK to profiles)
- `staff_id` (UUID, FK to staff, nullable)
- `start_time` (TIMESTAMPTZ, UTC)
- `end_time` (TIMESTAMPTZ, UTC)
- `duration_minutes` (INTEGER)
- `status` (TEXT: 'open', 'held', 'booked', 'pending_confirmation')
- `appointment_name` (TEXT, nullable)
- `booked_by_consumer_id` (UUID, FK to consumers, nullable)
- `booked_by_name` (TEXT, nullable)
- `consumer_phone` (TEXT, nullable)
- `held_until` (TIMESTAMPTZ, nullable)
- `created_via` (TEXT: 'dashboard', 'sms', 'api')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, nullable)

#### `consumers` (Customers)
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users, nullable)
- `name` (TEXT)
- `phone` (TEXT, UNIQUE, E.164 format)
- `saved_info` (BOOLEAN)
- `booking_count` (INTEGER)
- `created_at` (TIMESTAMPTZ)

#### `notify_requests` (Notification Preferences)
- `id` (UUID, PK)
- `merchant_id` (UUID, FK to profiles)
- `consumer_id` (UUID, FK to consumers)
- `time_range` (TEXT: 'today', 'next-few-days', 'custom')
- `created_at` (TIMESTAMPTZ)

#### `notifications` (SMS Log)
- `id` (UUID, PK)
- `merchant_id` (UUID, FK to profiles)
- `consumer_id` (UUID, FK to consumers)
- `slot_id` (UUID, FK to slots)
- `status` (TEXT: 'sent', 'failed', 'delivered')
- `sent_at` (TIMESTAMPTZ)

#### `staff` (Staff Members)
- `id` (UUID, PK)
- `merchant_id` (UUID, FK to profiles)
- `name` (TEXT)
- `phone` (TEXT, nullable)
- `email` (TEXT, nullable)
- `color` (TEXT, hex color)
- `is_primary` (BOOLEAN)
- `active` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `duration_presets` (Duration Presets)
- `id` (UUID, PK)
- `merchant_id` (UUID, FK to profiles)
- `duration_minutes` (INTEGER)
- `label` (TEXT)
- `is_default` (BOOLEAN)
- `position` (INTEGER)
- `color_token` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `appointment_type_presets` (Appointment Type Presets)
- `id` (UUID, PK)
- `merchant_id` (UUID, FK to profiles)
- `label` (TEXT)
- `is_default` (BOOLEAN)
- `position` (INTEGER)
- `color_token` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Row Level Security (RLS)

- **anon role**: Can only read `duration_presets` (public data)
- **authenticated role**: Can read/modify their own data
- **service_role**: Used in Edge Functions for all mutations

## API Endpoints

### Backend Server (Node/Express)

#### `POST /webhooks/twilio-sms`
- **Method**: POST
- **Purpose**: Receive SMS webhook from Twilio, parse with OpenAI, create opening in Supabase
- **Auth**: Twilio signature verification
- **Body**: Twilio webhook format (form-encoded)
- **Flow**: Twilio SMS → OpenAI API → Supabase Database

#### `GET /api/health`
- **Method**: GET
- **Purpose**: Health check endpoint
- **Auth**: Public
- **Response**: JSON with health status of database, Twilio, OpenAI, and server

### Edge Functions

#### `/functions/v1/send-sms`
- **Method**: POST
- **Purpose**: Send SMS via Twilio
- **Auth**: Service role (internal)
- **Body**:
  ```json
  {
    "to": "+1234567890",
    "message": "Your message here"
  }
  ```

#### `/functions/v1/notify-consumers`
- **Method**: POST
- **Purpose**: Notify all matching consumers when a slot is created
- **Auth**: Service role (internal)
- **Body**:
  ```json
  {
    "slotId": "uuid-here",
    "merchantId": "uuid-here"
  }
  ```

#### `/functions/v1/parse-sms-opening`
- **Method**: POST
- **Purpose**: Parse SMS messages to create openings (Twilio webhook)
- **Auth**: None (Twilio webhook)
- **Body**: Twilio form-encoded data
- **Uses**: OpenAI API for natural language parsing

#### `/functions/v1/handle-sms-reply`
- **Method**: POST
- **Purpose**: Handle incoming SMS replies for booking confirmation
- **Auth**: None (Twilio webhook)
- **Body**: Twilio form-encoded data

#### `/functions/v1/generate-otp`
- **Method**: POST
- **Purpose**: Generate OTP for phone authentication
- **Auth**: Service role (internal)

#### `/functions/v1/verify-otp`
- **Method**: POST
- **Purpose**: Verify OTP code
- **Auth**: Service role (internal)

#### `/functions/v1/resolve-slot`
- **Method**: GET
- **Purpose**: Resolve slot booking (consumer claim)
- **Auth**: Public (with HMAC signature)

#### `/functions/v1/qr-redirect`
- **Method**: GET
- **Purpose**: Redirect QR code short links
- **Auth**: Public

#### `/functions/v1/generate-merchant-qr`
- **Method**: POST
- **Purpose**: Generate QR code for merchant
- **Auth**: Authenticated

#### `/functions/v1/google-calendar-oauth-init`
- **Method**: POST
- **Purpose**: Initialize Google Calendar OAuth flow
- **Auth**: Authenticated

#### `/functions/v1/google-calendar-oauth-callback`
- **Method**: GET
- **Purpose**: Handle Google Calendar OAuth callback
- **Auth**: Public (OAuth callback)

#### `/functions/v1/push-bookings-to-calendar`
- **Method**: POST
- **Purpose**: Push bookings to Google Calendar
- **Auth**: Authenticated

#### `/functions/v1/sync-calendar-events`
- **Method**: POST
- **Purpose**: Sync calendar events from Google Calendar
- **Auth**: Authenticated

#### `/functions/v1/cleanup-expired-notifications`
- **Method**: POST
- **Purpose**: Clean up expired notifications (cron job)
- **Auth**: Service role (internal)

#### `/functions/v1/cleanup-calendar-events`
- **Method**: POST
- **Purpose**: Clean up calendar events (cron job)
- **Auth**: Service role (internal)

#### `/functions/v1/twilio-status-callback`
- **Method**: POST
- **Purpose**: Handle Twilio status callbacks
- **Auth**: None (Twilio webhook)

#### `/functions/v1/twilio-campaign-status`
- **Method**: GET/POST
- **Purpose**: Handle Twilio campaign status
- **Auth**: Service role (internal)

#### `/functions/v1/sms-canary`
- **Method**: POST
- **Purpose**: Test SMS sending (canary)
- **Auth**: Service role (internal)

#### `/functions/v1/health`
- **Method**: GET
- **Purpose**: Health check endpoint
- **Auth**: Public
- **Response**: JSON with health status of database, Twilio, OpenAI, and edge functions

## Supabase Roles

### anon
- **Purpose**: Anonymous/unauthenticated users
- **Permissions**: Read-only access to `duration_presets`
- **Usage**: Public-facing features (viewing slots, claiming slots)

### authenticated
- **Purpose**: Authenticated users (merchants and consumers)
- **Permissions**: Read/modify their own data
- **Usage**: Merchant dashboard, consumer settings

### service_role
- **Purpose**: Server-side operations
- **Permissions**: Full database access (bypasses RLS)
- **Usage**: Edge Functions, mutations, admin operations

## Twilio Integration

### SMS Sending
- Uses Twilio REST API
- Supports direct phone number or messaging service
- Status callbacks for delivery tracking
- E.164 format for phone numbers

### Webhooks
- **Inbound SMS**: `/functions/v1/parse-sms-opening` (merchant SMS intake)
- **SMS Replies**: `/functions/v1/handle-sms-reply` (booking confirmations)
- **Status Callbacks**: `/functions/v1/twilio-status-callback` (delivery status)

## OpenAI Integration

### SMS Parsing
- Uses OpenAI GPT-4o with structured outputs (JSON schema)
- Parses natural language SMS messages into structured data
- Handles appointment names, times, dates, durations
- Supports clarification questions for ambiguous requests
- Fallback to simple regex parser if OpenAI fails

### Configuration
- Model: `gpt-4o-2024-08-06`
- Temperature: 0.3 (for consistency)
- Response format: JSON schema
- Schema: Validates structured output format

## Google Calendar Integration

### OAuth Flow
1. Merchant initiates OAuth via `/functions/v1/google-calendar-oauth-init`
2. Redirects to Google OAuth consent screen
3. Google redirects to `/functions/v1/google-calendar-oauth-callback`
4. Callback stores encrypted credentials in `external_calendar_accounts` table
5. Frontend receives success message via postMessage

### Calendar Operations
- **Push Bookings**: Creates events in Google Calendar when slots are booked
- **Sync Events**: Syncs events from Google Calendar to slots
- **Cleanup**: Removes cancelled/deleted events from Google Calendar

### Encryption
- Credentials encrypted using `encrypt_calendar_credentials` database function
- Encryption key stored in `CALENDAR_ENCRYPTION_KEY` environment variable
- Decryption handled server-side only

## Frontend Routes

### Public Routes
- `/` - Landing page
- `/notify/:businessId` - Request notification form
- `/r/:shortCode` - QR code redirect
- `/claim/:slotId` - Claim available slot
- `/booking-confirmed/:slotId` - Confirmation page

### Consumer Routes (Authenticated)
- `/my-notifications` - View notification requests
- `/consumer/sign-in` - Consumer sign in
- `/consumer/settings` - Consumer settings

### Merchant Routes (Authenticated)
- `/merchant/login` - Merchant login
- `/merchant/openings` - View/manage openings
- `/merchant/analytics` - Analytics dashboard
- `/merchant/settings` - Merchant settings
- `/merchant/qr-code` - QR code generation

## Security

### Authentication
- Phone/SMS OTP authentication via Supabase Auth
- JWT tokens for API authentication
- Service role key for server-side operations

### Authorization
- Row Level Security (RLS) on all tables
- Policies enforce user-specific data access
- Service role bypasses RLS for mutations

### Data Validation
- Zod schemas for form validation
- E.164 format for phone numbers
- Timezone validation (IANA timezone strings)
- Duration validation (15-minute increments, max 3 hours)

### API Security
- HMAC signatures for public endpoints
- CORS headers for cross-origin requests
- Rate limiting (via Supabase)
- Input sanitization

## Deployment

### Frontend
- Build: `vite build`
- Output: `dist/` directory
- Hosting: Static hosting (Vercel, Netlify, Cloudflare Pages, etc.)

### Backend
- Edge Functions: Deploy via Supabase CLI
- Database: Managed by Supabase
- Migrations: Run via Supabase CLI

### Environment Variables
- Frontend: `VITE_*` prefix (public)
- Backend: Supabase secrets (private)
- See `docs/ENVIRONMENT.md` for complete list

## Monitoring

### Logging
- Edge Functions: Supabase logs
- Frontend: Browser console (dev) / Error tracking (prod)
- Twilio: Status callbacks for SMS delivery

### Analytics
- Slot creation/booking metrics
- Notification delivery rates
- Revenue estimates
- Peak booking times

## Future Enhancements

### Planned Features
- Multi-location support
- Team member accounts
- WhatsApp integration
- Custom branding
- Stripe payment integration
- Advanced analytics
- Bulk slot creation
- Calendar export (.ics) validation

