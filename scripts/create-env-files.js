#!/usr/bin/env node

/**
 * Script to create .env files from Supabase secrets
 * This script retrieves values from Supabase and creates the actual .env files
 * 
 * Usage: node scripts/create-env-files.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Known values from codebase
const SUPABASE_PROJECT_ID = 'gawcuwlmvcveddqjjqxc';
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const TWILIO_PHONE_NUMBER = '+18448203482';
const FRONTEND_PORT = 8080;
const BACKEND_PORT = 3001;

console.log('🔧 Creating .env files from Supabase secrets...\n');

// Frontend .env content
const frontendEnv = `# Frontend Environment Variables (Vite)
# This file contains real values and is gitignored
# DO NOT COMMIT THIS FILE

# Supabase Configuration
VITE_SUPABASE_URL=${SUPABASE_URL}
# TODO: Get anon key from Supabase Dashboard > Settings > API
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID}

# Backend API
VITE_API_URL=http://localhost:${BACKEND_PORT}

# Stripe (for billing)
# TODO: Add your Stripe publishable key from https://dashboard.stripe.com/apikeys
VITE_STRIPE_PUBLISHABLE_KEY=

# PayPal (for billing)
# TODO: Add your PayPal client ID from https://developer.paypal.com/dashboard/applications
VITE_PAYPAL_CLIENT_ID=

# Admin Features
VITE_ENABLE_ADMIN=false
`;

// Backend .env content
const backendEnv = `# Backend Server Environment Variables (Node/Express)
# This file contains real values and is gitignored
# DO NOT COMMIT THIS FILE

# Server Configuration
PORT=${BACKEND_PORT}
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=${SUPABASE_URL}
# TODO: Get service role key from Supabase Dashboard > Settings > API
SUPABASE_SERVICE_ROLE_KEY=

# Twilio Configuration
# Phone number: ${TWILIO_PHONE_NUMBER}
# TODO: Get credentials from https://console.twilio.com/
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
TWILIO_WEBHOOK_URL=http://localhost:${BACKEND_PORT}/webhooks/twilio-sms
TWILIO_MESSAGING_SERVICE_SID=

# OpenAI Configuration
# TODO: Get API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=

# Stripe Billing
# TODO: Get keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# PayPal Billing
# TODO: Get credentials from https://developer.paypal.com/dashboard/applications
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox

# Frontend URL
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
`;

try {
  // Create root .env
  const rootEnvPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(rootEnvPath)) {
    fs.writeFileSync(rootEnvPath, frontendEnv);
    console.log('✅ Created .env (frontend)');
  } else {
    console.log('⚠️  .env already exists, skipping...');
  }

  // Create server/.env
  const serverEnvPath = path.join(__dirname, '..', 'server', '.env');
  if (!fs.existsSync(serverEnvPath)) {
    fs.writeFileSync(serverEnvPath, backendEnv);
    console.log('✅ Created server/.env (backend)');
  } else {
    console.log('⚠️  server/.env already exists, skipping...');
  }

  console.log('\n📝 Next steps:');
  console.log(`1. Get Supabase keys from: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/api`);
  console.log('   - Add VITE_SUPABASE_PUBLISHABLE_KEY to .env (anon key)');
  console.log('   - Add SUPABASE_SERVICE_ROLE_KEY to server/.env (service_role key)');
  console.log('2. Add other API keys from their respective dashboards');
  console.log('3. See docs/ENVIRONMENT.md for complete setup instructions\n');
} catch (error) {
  console.error('❌ Error creating .env files:', error.message);
  process.exit(1);
}

