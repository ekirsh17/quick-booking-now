/**
 * Health Check Route
 * 
 * Simple health check endpoint to verify server status and dependencies.
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const checks: {
    status: string;
    timestamp: string;
    server: boolean;
    database: boolean;
    databaseError?: string;
    twilio: boolean;
    openai: boolean;
    error?: string;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: true,
    database: false,
    databaseError: undefined,
    twilio: false,
    openai: false,
    error: undefined,
  };

  try {
    // Check database connectivity
    if (config.supabase.url && config.supabase.serviceRoleKey) {
      try {
        const supabase = createClient(
          config.supabase.url,
          config.supabase.serviceRoleKey
        );
        const { error } = await supabase.from('profiles').select('id').limit(1);
        checks.database = !error;
        if (error) {
          checks.databaseError = error.message;
        }
      } catch (error) {
        checks.databaseError = error instanceof Error ? error.message : 'Unknown database error';
        console.error('Database check failed:', error);
      }
    }

    // Check Twilio credentials
    checks.twilio = !!(
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber
    );

    // Check OpenAI API key
    checks.openai = !!config.openai.apiKey;

    // Determine overall health status
    const allHealthy = checks.server && checks.database && checks.twilio && checks.openai;
    checks.status = allHealthy ? 'healthy' : 'degraded';

    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json(checks);
  } catch (error) {
    checks.status = 'unhealthy';
    checks.error = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json(checks);
  }
});
