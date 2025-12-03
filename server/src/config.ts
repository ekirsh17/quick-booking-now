/**
 * Configuration
 * 
 * Loads environment variables and provides configuration for the server.
 */

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  // Use RAILWAY_ENVIRONMENT if available (Railway sets this), otherwise fall back to NODE_ENV
  nodeEnv: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    webhookUrl: process.env.TWILIO_WEBHOOK_URL || '',
  },
  
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  
  // Stripe Billing
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  },
  
  // PayPal Billing
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    mode: (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live',
  },
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
};

// Validate required environment variables
// Skip validation if running on Railway (Railway injects variables at runtime)
const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'OPENAI_API_KEY',
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName] || process.env[varName] === ''
);

// Check if we're in production (Railway sets RAILWAY_ENVIRONMENT, or we use NODE_ENV)
const isProduction = (process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production');

// Only validate if not on Railway (Railway will inject variables at runtime)
if (!isRailway && missingEnvVars.length > 0) {
  const errorMessage = `Missing required environment variables:\n${missingEnvVars.map(v => `   - ${v}`).join('\n')}`;
  
  if (isProduction) {
    console.error('❌', errorMessage);
    console.error('   Server cannot start in production without these variables.');
    process.exit(1);
  } else {
    console.warn('⚠️  ', errorMessage);
    console.warn('   Server may not function correctly without these variables.');
  }
}

// Validate production-unsafe flags
const productionUnsafeFlags = [
  { name: 'TESTING_MODE', value: process.env.TESTING_MODE },
  { name: 'SKIP_TWILIO_SIGNATURE_VALIDATION', value: process.env.SKIP_TWILIO_SIGNATURE_VALIDATION },
];

if (isProduction) {
  for (const flag of productionUnsafeFlags) {
    if (flag.value === 'true') {
      console.error(`❌ SECURITY RISK: ${flag.name} is set to 'true' in production!`);
      console.error('   This is a security risk and must be disabled.');
      process.exit(1);
    }
  }
}

// Validate format of critical variables
if (config.twilio.phoneNumber && !config.twilio.phoneNumber.startsWith('+')) {
  console.warn('⚠️  TWILIO_PHONE_NUMBER should be in E.164 format (e.g., +1234567890)');
}

if (config.supabase.url && !config.supabase.url.startsWith('https://')) {
  console.warn('⚠️  SUPABASE_URL should start with https://');
}

// Export config type for TypeScript
export type Config = typeof config;

