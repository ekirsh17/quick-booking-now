import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfigCheck {
  name: string;
  required: boolean;
  present: boolean;
  value?: string;
  error?: string;
}

interface HealthStatus {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    supabase: ConfigCheck[];
    twilio: ConfigCheck[];
    notifications: ConfigCheck[];
    sms: ConfigCheck[];
    openai: ConfigCheck[];
  };
  summary: {
    total: number;
    required: number;
    present: number;
    missing: number;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const checks: HealthStatus['checks'] = {
    supabase: [],
    twilio: [],
    notifications: [],
    sms: [],
    openai: [],
  };

  // Check Supabase configuration
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  checks.supabase.push({
    name: 'SUPABASE_URL',
    required: true,
    present: !!supabaseUrl,
    value: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : undefined,
  });
  
  checks.supabase.push({
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    present: !!supabaseKey,
    value: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : undefined,
  });

  // Check Twilio configuration
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
  const useDirectNumber = Deno.env.get('USE_DIRECT_NUMBER') === 'true';
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

  checks.twilio.push({
    name: 'TWILIO_ACCOUNT_SID',
    required: true,
    present: !!twilioAccountSid,
    value: twilioAccountSid ? `${twilioAccountSid.substring(0, 10)}...` : undefined,
  });

  checks.twilio.push({
    name: 'TWILIO_AUTH_TOKEN',
    required: true,
    present: !!twilioAuthToken,
    value: twilioAuthToken ? '***' : undefined,
  });

  checks.twilio.push({
    name: 'USE_DIRECT_NUMBER',
    required: false,
    present: !!Deno.env.get('USE_DIRECT_NUMBER'),
    value: Deno.env.get('USE_DIRECT_NUMBER') || undefined,
  });

  if (useDirectNumber) {
    checks.twilio.push({
      name: 'TWILIO_PHONE_NUMBER',
      required: true,
      present: !!twilioPhoneNumber,
      value: twilioPhoneNumber || undefined,
      error: !twilioPhoneNumber ? 'Required when USE_DIRECT_NUMBER=true' : undefined,
    });
  } else {
    checks.twilio.push({
      name: 'TWILIO_MESSAGING_SERVICE_SID',
      required: true,
      present: !!messagingServiceSid,
      value: messagingServiceSid ? `${messagingServiceSid.substring(0, 10)}...` : undefined,
      error: !messagingServiceSid ? 'Required when USE_DIRECT_NUMBER=false' : undefined,
    });
  }

  // Check notification-related configuration
  const frontendUrl = Deno.env.get('FRONTEND_URL');
  checks.notifications.push({
    name: 'FRONTEND_URL',
    required: true,
    present: !!frontendUrl,
    value: frontendUrl || undefined,
    error: !frontendUrl ? 'Required for generating booking links in notifications' : undefined,
  });

  // Check SMS parsing configuration
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  checks.sms.push({
    name: 'OPENAI_API_KEY',
    required: true,
    present: !!openaiApiKey,
    value: openaiApiKey ? '***' : undefined,
    error: !openaiApiKey ? 'Required for SMS parsing via OpenAI' : undefined,
  });

  // Check OpenAI configuration (for AI features)
  checks.openai.push({
    name: 'OPENAI_API_KEY',
    required: true,
    present: !!openaiApiKey,
    value: openaiApiKey ? '***' : undefined,
  });

  // Calculate summary
  const allChecks = [
    ...checks.supabase,
    ...checks.twilio,
    ...checks.notifications,
    ...checks.sms,
    ...checks.openai,
  ];

  const requiredChecks = allChecks.filter(c => c.required);
  const presentRequired = requiredChecks.filter(c => c.present);
  const missingRequired = requiredChecks.filter(c => !c.present);

  const summary = {
    total: allChecks.length,
    required: requiredChecks.length,
    present: presentRequired.length,
    missing: missingRequired.length,
  };

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (missingRequired.length > 0) {
    status = 'unhealthy';
  } else if (allChecks.filter(c => !c.required && !c.present).length > 0) {
    status = 'degraded';
  }

  // Test database connectivity if credentials are present
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error: dbError } = await supabase.from('profiles').select('id').limit(1);
      if (dbError) {
        checks.supabase.push({
          name: 'DATABASE_CONNECTIVITY',
          required: true,
          present: false,
          error: `Database connection failed: ${dbError.message}`,
        });
        status = 'unhealthy';
      } else {
        checks.supabase.push({
          name: 'DATABASE_CONNECTIVITY',
          required: true,
          present: true,
        });
      }
    } catch (error) {
      checks.supabase.push({
        name: 'DATABASE_CONNECTIVITY',
        required: true,
        present: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      status = 'unhealthy';
    }
  }

  const healthStatus: HealthStatus = {
    timestamp: new Date().toISOString(),
    status,
    checks,
    summary,
  };

  const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return new Response(
    JSON.stringify(healthStatus, null, 2),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});





