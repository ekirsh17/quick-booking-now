/**
 * Quick Booking Now - Backend Server
 * 
 * Node/Express server for handling SMS intake from Twilio.
 * Flow: Twilio SMS → OpenAI API → Supabase Database
 */

import express from 'express';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { twilioWebhookRouter } from './routes/twilio-sms.js';

const app = express();
const PORT = config.port || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);
app.use('/webhooks/twilio-sms', twilioWebhookRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Quick Booking Now API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
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
  console.log(`📍 Twilio webhook: http://localhost:${PORT}/webhooks/twilio-sms`);
});

