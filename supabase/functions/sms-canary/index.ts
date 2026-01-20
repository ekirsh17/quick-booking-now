import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to } = await req.json().catch(() => ({}));
    const testNumber = to || '+15165879844';
    const timestamp = new Date().toISOString();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('[Canary] Sending test SMS to:', testNumber);
    
    // Call send-sms function
    const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        to: testNumber,
        message: `OpenAlert Canary Test - ${timestamp}`,
      }),
    });

    const result = await response.json();
    console.log('[Canary] send-sms result:', result);
    
    // Fetch the actual sent message details from Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    
    if (result.success && result.messageSid && result.messageSid !== 'test-mode-blocked') {
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${result.messageSid}.json`,
        {
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          },
        }
      );
      
      const twilioData = await twilioResponse.json();
      console.log('[Canary] Twilio data:', twilioData);
      
      return new Response(
        JSON.stringify({
          canary: 'success',
          sid: result.messageSid,
          status: twilioData.status,
          from: twilioData.from,
          to: twilioData.to,
          via: result.via,
          timestamp,
          env: {
            USE_DIRECT_NUMBER: Deno.env.get('USE_DIRECT_NUMBER'),
            TWILIO_PHONE_NUMBER: Deno.env.get('TWILIO_PHONE_NUMBER')?.substring(0, 6) + '***',
          }
        }, null, 2),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Test mode blocked or other issue
    return new Response(
      JSON.stringify({
        canary: 'blocked',
        result,
        timestamp,
        env: {
          TESTING_MODE: Deno.env.get('TESTING_MODE'),
          USE_DIRECT_NUMBER: Deno.env.get('USE_DIRECT_NUMBER'),
        }
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error: any) {
    console.error('[Canary] Error:', error);
    return new Response(
      JSON.stringify({ 
        canary: 'error',
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
