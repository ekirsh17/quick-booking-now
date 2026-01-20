/**
 * Quick Booking Now - Backend Server
 * 
 * Node/Express server for handling SMS intake from Twilio and billing.
 * Flow: Twilio SMS → OpenAI API → Supabase Database
 * Billing: Stripe/PayPal → Webhooks → Supabase Database
 */

import express from 'express';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { twilioWebhookRouter } from './routes/twilio-sms.js';
import billingRouter from './routes/billing.js';
import paypalRouter from './routes/paypal.js';

const app = express();
const PORT = config.port || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const printableHost = HOST === '0.0.0.0' ? 'localhost' : HOST;

// CORS middleware for frontend requests
// Keep allowed origins in sync with frontend deployments.
app.use((req, res, next) => {
  const rawAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'https://openalert.org',
    'https://www.openalert.org',
    process.env.FRONTEND_URL,
  ]
    .concat((process.env.FRONTEND_URLS || '').split(','))
    .filter((origin): origin is string => typeof origin === 'string' && origin.trim().length > 0)
    .map((origin) => origin.trim());
  
  const origin = req.headers.origin;
  if (typeof origin === 'string' && rawAllowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Quick health/ready signals for preview tools
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'quick-booking-now-server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/billing', billingRouter);
app.use('/api/billing/paypal', paypalRouter);
app.use('/webhooks/twilio-sms', twilioWebhookRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'quick-booking-now-server',
    message: 'Backend running. This is an API server.',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      billing: '/api/billing',
      twilioWebhook: '/webhooks/twilio-sms',
    },
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, HOST, () => {
  const baseUrl = `http://${printableHost}:${PORT}`;
  console.log(`🚀 Server listening on ${baseUrl}`);
  console.log(`📍 Root: ${baseUrl}/`);
  console.log(`📍 Health check: ${baseUrl}/health`);
  console.log(`📍 API health: ${baseUrl}/api/health`);
  console.log(`📍 Billing API: ${baseUrl}/api/billing`);
  console.log(`📍 Twilio webhook: ${baseUrl}/webhooks/twilio-sms`);
});
