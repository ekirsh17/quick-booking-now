import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  validateTwilioSignature, 
  parseTwilioFormData,
  getWebhookUrl 
} from '../shared/twilioValidation.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse Twilio webhook payload first (needed for validation)
    const params = await parseTwilioFormData(req);
    
    // Validate Twilio signature - CRITICAL for security
    if (!TWILIO_AUTH_TOKEN) {
      console.error('[handle-sms-reply] TWILIO_AUTH_TOKEN not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    const signature = req.headers.get('X-Twilio-Signature') || '';
    const webhookUrl = getWebhookUrl(req);
    
    const isValid = await validateTwilioSignature(
      TWILIO_AUTH_TOKEN,
      signature,
      webhookUrl,
      params
    );

    if (!isValid) {
      console.warn('[handle-sms-reply] Invalid Twilio signature - rejecting request');
      return new Response('Invalid signature', { status: 403 });
    }
    
    console.log('[handle-sms-reply] Signature validated successfully');

    // Extract message data from validated params
    const from = params['From']; // Sender phone
    const messageBody = params['Body']?.trim(); // Message body
    const messageSid = params['MessageSid'];

    if (!from || !messageBody) {
      return new Response('Invalid request', { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log inbound message
    if (messageSid) {
      await supabase.from('sms_logs').insert({
        message_sid: messageSid,
        to_number: Deno.env.get('TWILIO_PHONE_NUMBER') || 'unknown',
        from_number: from,
        body: messageBody,
        status: 'received',
        direction: 'inbound',
      });
    }

    const body = messageBody.toLowerCase();

    // Handle STOP/unsubscribe request
    if (body === 'stop' || body === 'unsubscribe' || body === 'cancel') {
      // Delete all notify_requests for this phone number
      const { data: consumer } = await supabase
        .from('consumers')
        .select('id')
        .eq('phone', from)
        .maybeSingle();

      if (consumer) {
        const { data: deleted, error: deleteError } = await supabase
          .from('notify_requests')
          .delete()
          .eq('consumer_id', consumer.id)
          .select('id');

        if (deleteError) {
          console.error('Error deleting notify requests:', deleteError);
        } else {
          console.log(`Unsubscribed ${from}, deleted ${deleted?.length || 0} requests`);
        }
      }

      await sendSMS(
        from,
        "You've been unsubscribed from all notifications. Reply START to resubscribe anytime."
      );

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Unsubscribed successfully</Message></Response>',
        { 
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        }
      );
    }

    // Handle START/resubscribe request
    if (body === 'start' || body === 'resubscribe') {
      await sendSMS(
        from,
        "Welcome back! Visit a business's OpenAlert page to sign up for availability notifications."
      );

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Resubscribed successfully</Message></Response>',
        { 
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        }
      );
    }

    // Reply-based YES/NO email opening confirmations are intentionally parked for this phase.
    if (body === 'yes' || body === 'y' || body === 'no' || body === 'n') {
      console.info('[handle-sms-reply] yes/no email confirmation flow is parked');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>SMS YES/NO confirmations are currently disabled. Please create openings from the OpenAlert dashboard.</Message></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        }
      );
    }

    // Reply-based booking approval is intentionally parked for this phase.
    // Merchants should use the approval link from claim-slot messages or dashboard approvals.
    if (body === 'confirm' || body === 'approve') {
      console.info('[handle-sms-reply] confirm/approve reply flow is parked');

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>SMS reply approvals are currently disabled. Please use the approval link in your booking alert or open the OpenAlert dashboard.</Message></Response>',
        { 
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        }
      );
    }

    // Echo back received message for testing
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Received: ${messageBody}</Message></Response>`,
      { 
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    );
  } catch (error: unknown) {
    console.error('Error in handle-sms-reply:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function sendSMS(to: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: fromNumber!,
      To: to,
      Body: message,
    }),
  });
}

serve(handler);
