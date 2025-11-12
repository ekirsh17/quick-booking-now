# Cursor Migration: Hygiene, Docs, Lovable Removal, SMS Backend Plan

## Summary

This PR finalizes the migration from Lovable to Cursor with zero Lovable dependencies while preserving all current behavior. The codebase now uses a Node/Express backend for SMS intake (Twilio → OpenAI → Supabase flow) instead of Supabase Edge Functions, providing more flexibility and easier local development.

## Changes Made

### 1. Project Hygiene ✅

- **Updated `.cursorrules`**: 
  - Added Node/Express backend for SMS intake
  - Updated file structure to include `server/` directory
  - Updated deployment section for Node/Express server
  - Kept Supabase Edge Functions for auth, notifications, calendar

- **Verified `.nvmrc`**: Set to Node 20 ✅
- **Verified `.gitignore`**: Already ignores `.env` ✅
- **Verified `package.json` scripts**: `dev`, `build`, `lint` ✅
- **Removed `lovable-tagger`**: Already removed from `package.json` and `vite.config.ts` ✅

### 2. Documentation ✅

- **Updated `docs/ARCHITECTURE.md`**:
  - Added Node/Express backend section
  - Updated API endpoints section
  - Added backend server endpoints (`/webhooks/twilio-sms`, `/api/health`)
  - Kept Edge Functions documentation for auth, notifications, calendar

- **Updated `docs/ENVIRONMENT.md`**:
  - Added Node/Express server environment variables
  - Added `PORT`, `NODE_ENV` for server configuration
  - Added `TWILIO_WEBHOOK_URL` for webhook configuration
  - Updated setup instructions for backend server

- **Updated `docs/WEBHOOKS.md`**:
  - Changed endpoint from Supabase Edge Function to Node/Express server
  - Updated webhook URL configuration
  - Added signature verification section
  - Updated processing flow documentation

- **Created `server/README.md`**:
  - Complete setup guide for Node/Express backend
  - Architecture overview
  - API endpoints documentation
  - Deployment instructions
  - Security practices
  - TODO list for implementation

### 3. Lovable Removal ✅

- **Verified no Lovable references**: 
  - ✅ No Lovable AI dependencies in code
  - ✅ No Lovable references in `supabase/functions/parse-sms-opening/index.ts` (already using OpenAI API)
  - ✅ No Lovable references in frontend code
  - ✅ No Lovable references in backend code

- **OpenAI API Integration**:
  - Already using OpenAI API directly (not Lovable gateway)
  - Uses OpenAI GPT-4o with structured outputs (JSON schema)
  - Model: `gpt-4o-2024-08-06`
  - Temperature: 0.3 (for consistency)
  - Fallback to simple regex parser if OpenAI fails

### 4. Backend Server (Node/Express) ✅

**Created `server/` directory with**:
- `server/package.json` - Node/Express dependencies
- `server/tsconfig.json` - TypeScript configuration
- `server/.env.example` - Environment variables template
- `server/.gitignore` - Git ignore rules
- `server/README.md` - Setup and documentation

**Created `server/src/` directory with**:
- `server/src/index.ts` - Express server setup
- `server/src/config.ts` - Configuration and environment variables
- `server/src/routes/health.ts` - Health check endpoint
- `server/src/routes/twilio-sms.ts` - Twilio SMS webhook handler (TODO: implement)

**API Endpoints**:
- `GET /api/health` - Health check endpoint (✅ implemented)
- `POST /webhooks/twilio-sms` - Twilio SMS webhook (⚠️ TODO: implement)

### 5. Architecture Decisions

**Why Node/Express instead of Supabase Edge Functions?**
- **Local Development**: Easier to run and debug locally
- **Flexibility**: More control over dependencies and tooling
- **Deployment**: Can deploy to Vercel, Railway, Render, etc.
- **Testing**: Easier to write and run tests
- **Monitoring**: Better integration with monitoring tools

**What stays as Supabase Edge Functions?**
- **Auth**: OTP generation and verification
- **Notifications**: Consumer notification system
- **Calendar**: Google Calendar integration
- **Other**: QR code generation, slot resolution, etc.

**Why keep both?**
- **Separation of Concerns**: SMS intake is separate from other functionality
- **Independent Deployment**: Can deploy SMS intake separately
- **Scalability**: Can scale SMS intake independently
- **Maintainability**: Easier to maintain and update

## Files Changed

### Modified
- `.cursorrules` - Updated to include Node/Express backend
- `docs/ARCHITECTURE.md` - Updated architecture documentation
- `docs/ENVIRONMENT.md` - Updated environment variables documentation
- `docs/WEBHOOKS.md` - Updated webhook documentation

### Created
- `server/package.json` - Node/Express dependencies
- `server/tsconfig.json` - TypeScript configuration
- `server/.env.example` - Environment variables template
- `server/.gitignore` - Git ignore rules
- `server/README.md` - Setup and documentation
- `server/src/index.ts` - Express server setup
- `server/src/config.ts` - Configuration
- `server/src/routes/health.ts` - Health check endpoint
- `server/src/routes/twilio-sms.ts` - Twilio SMS webhook handler (TODO)

## TODO: Implementation Steps

### Step 1: Setup Backend Server
- [ ] Install dependencies: `cd server && npm install`
- [ ] Create `.env` file from `.env.example`
- [ ] Fill in environment variables
- [ ] Test health endpoint: `curl http://localhost:3001/api/health`

### Step 2: Implement Twilio Signature Verification
- [ ] Install `twilio` package (already in `package.json`)
- [ ] Implement signature verification in `server/src/routes/twilio-sms.ts`
- [ ] Test with Twilio webhook simulator
- [ ] Add error handling for invalid signatures

### Step 3: Implement Merchant Lookup
- [ ] Create `server/src/services/merchant.ts`
- [ ] Implement `lookupMerchant(phoneNumber: string)` function
- [ ] Query Supabase `profiles` table by phone number
- [ ] Handle merchant not found errors
- [ ] Add tests

### Step 4: Implement OpenAI SMS Parsing
- [ ] Create `server/src/services/openai.ts`
- [ ] Implement `parseSMSWithOpenAI(message: string, merchant: Merchant)` function
- [ ] Use OpenAI GPT-4o with structured outputs (JSON schema)
- [ ] Handle OpenAI API errors
- [ ] Add fallback to simple regex parser
- [ ] Add tests

### Step 5: Implement Opening Creation
- [ ] Create `server/src/services/opening.ts`
- [ ] Implement `createOpening(merchantId: string, parsedOpening: ParsedOpening)` function
- [ ] Insert into Supabase `slots` table
- [ ] Handle timezone conversion
- [ ] Handle conflict detection
- [ ] Add tests

### Step 6: Implement Confirmation SMS
- [ ] Create `server/src/services/twilio.ts`
- [ ] Implement `sendConfirmationSMS(phoneNumber: string, opening: Opening)` function
- [ ] Send SMS via Twilio API
- [ ] Format confirmation message
- [ ] Handle SMS sending errors
- [ ] Add tests

### Step 7: Implement Consumer Notifications
- [ ] Call Supabase Edge Function `notify-consumers`
- [ ] Pass `slotId` and `merchantId`
- [ ] Handle notification errors
- [ ] Add tests

### Step 8: Testing
- [ ] Test Twilio webhook with real SMS
- [ ] Test OpenAI parsing with various SMS formats
- [ ] Test opening creation in Supabase
- [ ] Test confirmation SMS sending
- [ ] Test consumer notifications
- [ ] Test error handling
- [ ] Test signature verification

### Step 9: Deployment
- [ ] Deploy backend server to Vercel/Railway/Render
- [ ] Set environment variables in deployment platform
- [ ] Update Twilio webhook URL in Twilio Console
- [ ] Test webhook in production
- [ ] Monitor logs and errors
- [ ] Set up monitoring and alerts

### Step 10: Documentation
- [ ] Update `server/README.md` with implementation details
- [ ] Update `docs/WEBHOOKS.md` with production webhook URL
- [ ] Update `docs/ARCHITECTURE.md` with implementation details
- [ ] Add API documentation
- [ ] Add troubleshooting guide

## Testing

### Before Merging

1. **Verify repository hygiene**:
   ```bash
   # Check .cursorrules exists
   ls -la .cursorrules
   
   # Check .nvmrc exists and is Node 20
   cat .nvmrc
   
   # Check .gitignore ignores .env
   grep -q "\.env" .gitignore && echo "✅ .env in .gitignore" || echo "❌ .env not in .gitignore"
   
   # Check package.json scripts
   cat package.json | grep -A 5 "scripts"
   ```

2. **Verify backend server structure**:
   ```bash
   # Check server directory exists
   ls -la server/
   
   # Check server files exist
   ls -la server/src/
   ls -la server/src/routes/
   ```

3. **Verify documentation**:
   ```bash
   # Check docs exist
   ls -la docs/
   
   # Check server README exists
   ls -la server/README.md
   ```

### After Merging

1. **Setup backend server**:
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Fill in .env file
   npm run dev
   ```

2. **Test health endpoint**:
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Implement TODO items** (see TODO section above)

## Environment Variables

### Frontend (`.env`)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### Backend Server (`server/.env`)
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
FRONTEND_URL=http://localhost:8080
```

## Breaking Changes

⚠️ **IMPORTANT**: This PR introduces a new backend server architecture but does NOT break existing functionality. The Supabase Edge Function `parse-sms-opening` still exists and can be used until the Node/Express backend is fully implemented.

**Migration Path**:
1. Deploy Node/Express backend server
2. Implement Twilio webhook handler
3. Update Twilio webhook URL to point to Node/Express server
4. Test and verify functionality
5. Remove Supabase Edge Function `parse-sms-opening` (optional)

## Assumptions

1. **Node/Express Backend**: Assumes Node.js 20 and Express.js for backend server
2. **Supabase**: Assumes existing Supabase project and database
3. **Twilio**: Assumes existing Twilio account and phone number
4. **OpenAI**: Assumes OpenAI API key is available
5. **Deployment**: Assumes deployment to Vercel, Railway, Render, or similar platform

## Notes

- **No Supabase CLI Required**: This PR does not require Supabase CLI for the SMS intake backend
- **Local Development**: Backend server can be run locally with `npm run dev`
- **Independent Deployment**: Backend server can be deployed independently from frontend
- **Backward Compatible**: Existing Supabase Edge Functions remain unchanged
- **TODO Implementation**: Twilio webhook handler is scaffolded but not yet implemented (see TODO section)

## Success Criteria

✅ Zero Lovable dependencies in code
✅ Node/Express backend server scaffolded
✅ Health check endpoint implemented
✅ Documentation updated
✅ Environment variables documented
✅ TODO list created for implementation
✅ Repository hygiene verified
✅ Backward compatible (no breaking changes)

## Questions?

If you have questions about this migration, please:
1. Check the documentation in `docs/` directory
2. Check the server documentation in `server/README.md`
3. Review the TODO list for implementation steps
4. Check environment variables in `docs/ENVIRONMENT.md`
5. Review webhook configuration in `docs/WEBHOOKS.md`
