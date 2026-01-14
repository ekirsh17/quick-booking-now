#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates that required environment variables are set and checks for placeholders
 * 
 * Usage: node scripts/validate-env.js [--frontend|--backend|--all]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLACEHOLDER_PATTERNS = [
  /your_.*_here/i,
  /placeholder/i,
  /example/i,
  /xxx+/i,
  /^$/,
];

const PRODUCTION_UNSAFE_VARS = [
  'TESTING_MODE',
  'SKIP_TWILIO_SIGNATURE_VALIDATION',
];

const isCi = process.env.CI === 'true';
const isVercel = process.env.VERCEL === '1';
const isProductionRuntime = (
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT === 'production' ||
  isCi
);
const allowMinimalBackend = process.env.ALLOW_MINIMAL_BACKEND === 'true' && !isProductionRuntime;

function checkPlaceholder(value, varName) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value));
}

function validateFrontend() {
  console.log('🔍 Validating frontend environment variables...\n');
  
  const envPath = path.join(__dirname, '..', '.env');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } else if (isCi || isVercel) {
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('VITE_')) {
        envVars[key] = process.env[key];
      }
    });
  } else {
    console.error('❌ .env file not found!');
    console.log('   Create it by copying .env.example: cp .env.example .env\n');
    return false;
  }

  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PROJECT_ID',
  ];

  const optional = [
    'VITE_API_URL',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_PAYPAL_CLIENT_ID',
    'VITE_ENABLE_ADMIN',
  ];

  let hasErrors = false;
  const issues = [];

  // Check required variables
  for (const varName of required) {
    const value = envVars[varName];
    if (!value) {
      issues.push(`❌ Missing required variable: ${varName}`);
      hasErrors = true;
    } else if (checkPlaceholder(value, varName)) {
      issues.push(`⚠️  Placeholder detected in ${varName}: "${value}"`);
      hasErrors = true;
    }
  }

  // Check optional variables (warn if placeholder)
  for (const varName of optional) {
    const value = envVars[varName];
    if (value && checkPlaceholder(value, varName)) {
      issues.push(`⚠️  Placeholder detected in ${varName}: "${value}"`);
    }
  }

  // Check for production-unsafe flags
  for (const varName of PRODUCTION_UNSAFE_VARS) {
    if (envVars[varName] === 'true' && process.env.NODE_ENV === 'production') {
      issues.push(`🚨 SECURITY: ${varName} is set to true in production!`);
      hasErrors = true;
    }
  }

  // Validate URL formats
  if (envVars.VITE_SUPABASE_URL && !envVars.VITE_SUPABASE_URL.startsWith('https://')) {
    issues.push(`⚠️  VITE_SUPABASE_URL should start with https://`);
  }

  if (issues.length > 0) {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log();
  } else {
    console.log('✅ All frontend environment variables are valid!\n');
  }

  return !hasErrors;
}

function validateBackend() {
  console.log('🔍 Validating backend environment variables...\n');
  
  const envPath = path.join(__dirname, '..', 'server', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ server/.env file not found!');
    console.log('   Create it by copying server/.env.example: cp server/.env.example server/.env\n');
    if (allowMinimalBackend) {
      console.log('⚠️  Minimal backend mode enabled: continuing without server/.env for local development.\n');
      return true;
    }
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'OPENAI_API_KEY',
  ];

  const optional = [
    'PORT',
    'NODE_ENV',
    'TWILIO_WEBHOOK_URL',
    'TWILIO_MESSAGING_SERVICE_SID',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'PAYPAL_MODE',
    'FRONTEND_URL',
  ];

  let hasErrors = false;
  const issues = [];
  const missingRequired = [];

  // Check required variables
  for (const varName of required) {
    const value = envVars[varName];
    if (!value) {
      issues.push(`❌ Missing required variable: ${varName}`);
      missingRequired.push(varName);
      hasErrors = true;
    } else if (checkPlaceholder(value, varName)) {
      issues.push(`⚠️  Placeholder detected in ${varName}: "${value}"`);
      hasErrors = true;
    }
  }

  // Check optional variables (warn if placeholder)
  for (const varName of optional) {
    const value = envVars[varName];
    if (value && checkPlaceholder(value, varName)) {
      issues.push(`⚠️  Placeholder detected in ${varName}: "${value}"`);
    }
  }

  // Check for production-unsafe flags
  for (const varName of PRODUCTION_UNSAFE_VARS) {
    if (envVars[varName] === 'true' && process.env.NODE_ENV === 'production') {
      issues.push(`🚨 SECURITY: ${varName} is set to true in production!`);
      hasErrors = true;
    }
  }

  // Validate formats
  if (envVars.TWILIO_PHONE_NUMBER && !envVars.TWILIO_PHONE_NUMBER.startsWith('+')) {
    issues.push(`⚠️  TWILIO_PHONE_NUMBER should be in E.164 format (e.g., +1234567890)`);
  }

  if (envVars.SUPABASE_URL && !envVars.SUPABASE_URL.startsWith('https://')) {
    issues.push(`⚠️  SUPABASE_URL should start with https://`);
  }

  if (issues.length > 0) {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log();

    if (allowMinimalBackend && hasErrors) {
      console.log('⚠️  Minimal backend mode enabled: continuing with limited backend functionality for local development.');
      if (missingRequired.length > 0) {
        console.log(`   Missing variables: ${missingRequired.join(', ')}`);
      }
      console.log('   Twilio/OpenAI/Supabase integrations will be unavailable until these are configured.\n');
      hasErrors = false;
    }
  } else {
    console.log('✅ All backend environment variables are valid!\n');
  }

  return !hasErrors;
}

// Main execution
const args = process.argv.slice(2);
const mode = args.includes('--frontend') ? 'frontend' : 
             args.includes('--backend') ? 'backend' : 'all';

let allValid = true;

if (mode === 'frontend' || mode === 'all') {
  allValid = validateFrontend() && allValid;
}

if (mode === 'backend' || mode === 'all') {
  allValid = validateBackend() && allValid;
}

if (!allValid) {
  console.log('💡 Tip: Use .env.example files as templates');
  console.log('   Frontend: cp .env.example .env');
  console.log('   Backend: cp server/.env.example server/.env\n');
  process.exit(1);
}

process.exit(0);
