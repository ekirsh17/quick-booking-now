import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    database: false,
    twilio: false,
    openai: false,
    edge_functions: true,
  };

  try {
    // Check database connectivity
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error: dbError } = await supabase.from('profiles').select('id').limit(1);
      checks.database = !dbError;
    }

    // Check Twilio connectivity (verify credentials are set)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    
    if (twilioAccountSid && twilioAuthToken) {
      // Just verify credentials exist, don't make actual API call to avoid costs
      checks.twilio = true;
    }

    // Check OpenAI API key is set
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    checks.openai = !!openaiApiKey;

    // Determine overall health status
    const allHealthy = checks.database && checks.edge_functions;
    checks.status = allHealthy ? 'healthy' : 'degraded';

    const statusCode = allHealthy ? 200 : 503;

    return new Response(
      JSON.stringify(checks, null, 2),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    checks.status = 'unhealthy';
    checks.error = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify(checks, null, 2),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

