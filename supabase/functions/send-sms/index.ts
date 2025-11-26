import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
const USE_DIRECT_NUMBER = Deno.env.get('USE_DIRECT_NUMBER') === 'true';
const MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
const TESTING_MODE = Deno.env.get('TESTING_MODE') === 'true';
const VERIFIED_TEST_NUMBER = '+15165879844';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  to: string;
  message: string;
  merchant_id?: string; // Optional: for multi-tenant SMS tracking
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, merchant_id }: SendSmsRequest = await req.json();

    console.log('[send-sms] Sending SMS to:', to?.substring(0, 5) + '***', merchant_id ? `(merchant: ${merchant_id.substring(0, 8)}...)` : '');

    // Validate inputs
    if (!to || !message) {
      throw new Error('Missing required fields: to and message');
    }

    // Validate and normalize phone format (E.164: +[country][number])
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    const normalized = to.trim().replace(/[\s\-\(\)]/g, '');
    
    if (!e164Regex.test(normalized)) {
      console.error('Invalid phone number format:', to);
      throw new Error('Invalid phone number format. Please use international format (e.g., +12125551234)');
    }

    // Testing mode safeguard
    if (TESTING_MODE && normalized !== VERIFIED_TEST_NUMBER) {
      console.warn(`TESTING_MODE: Blocked send to ${normalized}. Only ${VERIFIED_TEST_NUMBER} allowed.`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageSid: 'test-mode-blocked',
          warning: 'TESTING_MODE: Only verified numbers allowed'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Send SMS using Twilio
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    // Build Twilio parameters with conditional routing
    const twilioParams: Record<string, string> = {
      To: normalized,
      Body: message,
      StatusCallback: `${SUPABASE_URL}/functions/v1/twilio-status-callback`,
    };

    // Conditional routing: direct number vs messaging service
    if (USE_DIRECT_NUMBER) {
      twilioParams.From = TWILIO_PHONE_NUMBER!;
      console.log('[SMS] Using direct number:', TWILIO_PHONE_NUMBER);
    } else {
      if (!MESSAGING_SERVICE_SID) {
        throw new Error('TWILIO_MESSAGING_SERVICE_SID not configured');
      }
      twilioParams.MessagingServiceSid = MESSAGING_SERVICE_SID;
      console.log('[SMS] Using Messaging Service:', MESSAGING_SERVICE_SID);
    }
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(twilioParams),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Twilio error:', error);
      throw new Error(`Failed to send SMS: ${error}`);
    }

    const data = await response.json();
    console.log('SMS sent successfully:', data.sid);

    // Log to database with merchant_id for multi-tenant tracking
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const fromNumber = USE_DIRECT_NUMBER ? TWILIO_PHONE_NUMBER : data.from || TWILIO_PHONE_NUMBER;
    
    const { error: logError } = await supabase.from('sms_logs').insert({
      message_sid: data.sid,
      to_number: normalized,
      from_number: fromNumber,
      body: message,
      status: 'queued',
      direction: 'outbound',
      merchant_id: merchant_id || null,
    });
    
    if (logError) {
      console.warn('[send-sms] Failed to log SMS:', logError.message);
      // Don't fail the request - SMS was sent successfully
    }

    // Track SMS usage for billing if merchant_id is provided
    if (merchant_id) {
      // Get subscription for this merchant
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('merchant_id', merchant_id)
        .single();
      
      if (subscription && !subError) {
        // Increment SMS usage counter
        const { error: usageError } = await supabase.rpc('increment_sms_usage', {
          p_subscription_id: subscription.id,
          p_count: 1,
        });
        
        if (usageError) {
          console.warn('[send-sms] Failed to track SMS usage:', usageError.message);
        } else {
          console.log('[send-sms] SMS usage incremented for merchant:', merchant_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: data.sid,
        status: data.status,
        via: USE_DIRECT_NUMBER ? 'direct' : 'messaging-service'
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-sms function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
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
