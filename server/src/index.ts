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

// CORS middleware for frontend requests
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
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

// Routes
app.use('/api/health', healthRouter);
app.use('/api/billing', billingRouter);
app.use('/api/billing/paypal', paypalRouter);
app.use('/webhooks/twilio-sms', twilioWebhookRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Quick Booking Now API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      billing: '/api/billing',
      twilioWebhook: '/webhooks/twilio-sms'
    }
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Billing API: http://localhost:${PORT}/api/billing`);
  console.log(`📍 Twilio webhook: http://localhost:${PORT}/webhooks/twilio-sms`);
});

