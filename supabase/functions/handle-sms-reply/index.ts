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

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

const COMMANDS_DISABLED_MESSAGE =
  'SMS commands are currently disabled. Please use the OpenAlert dashboard.';

function twimlResponse(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : EMPTY_TWIML;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function getSignatureValidationUrls(req: Request): string[] {
  const requestUrl = normalizeUrl(getWebhookUrl(req));
  const explicitTwilioWebhookUrl = Deno.env.get('TWILIO_WEBHOOK_URL')?.trim();
  const projectWebhookUrl = `${normalizeUrl(supabaseUrl)}/functions/v1/handle-sms-reply`;

  const candidates = [
    requestUrl,
    explicitTwilioWebhookUrl ? normalizeUrl(explicitTwilioWebhookUrl) : null,
    projectWebhookUrl,
  ].filter((value): value is string => Boolean(value));

  // Twilio may sign with or without trailing slash depending on webhook config.
  const expanded = candidates.flatMap((value) => [value, `${value}/`]);
  return [...new Set(expanded)];
}

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
    const validationUrls = getSignatureValidationUrls(req);
    let isValid = false;
    let matchedUrl: string | null = null;

    for (const validationUrl of validationUrls) {
      const candidateValid = await validateTwilioSignature(
        TWILIO_AUTH_TOKEN,
        signature,
        validationUrl,
        params
      );

      if (candidateValid) {
        isValid = true;
        matchedUrl = validationUrl;
        break;
      }
    }

    if (!isValid) {
      console.warn('[handle-sms-reply] Invalid Twilio signature - rejecting request');
      return new Response('Invalid signature', { status: 403 });
    }
    
    console.log(`[handle-sms-reply] Signature validated successfully (url: ${matchedUrl})`);

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
    const optOutType = params['OptOutType'];
    const messagingServiceSid = params['MessagingServiceSid'];
    const toNumber = params['To'];

    console.info(
      `[handle-sms-reply] inbound body="${body}" optOutType=${optOutType ?? 'none'} messagingServiceSid=${messagingServiceSid ?? 'none'} to=${toNumber ?? 'unknown'}`
    );

    // Twilio Advanced Opt-Out sends START/STOP/HELP replies before the webhook when enabled
    // on the inbound Messaging Service. Avoid duplicate TwiML replies in those cases.
    if (optOutType === 'HELP' || body === 'help') {
      console.info('[handle-sms-reply] HELP handled by Twilio Advanced Opt-Out; skipping TwiML reply');
      return twimlResponse();
    }

    // Handle STOP request
    if (body === 'stop' || optOutType === 'STOP') {
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

      // Toll-free + Advanced Opt-Out already sends carrier/network STOP messaging.
      // Returning TwiML here would duplicate compliance texts.
      return twimlResponse();
    }

    // Handle START request
    if (body === 'start' || optOutType === 'START') {
      // Toll-free START always gets carrier + Messaging Service opt-in copy from Twilio.
      // Customize that text in Messaging Service → Opt-Out Management → Opt-In confirmation.
      // Phone-number webhooks may omit OptOutType, so never send a second START TwiML reply.
      console.info('[handle-sms-reply] START handled by Twilio; skipping TwiML reply');
      return twimlResponse();
    }

    // All non-STOP/START inbound commands are intentionally disabled for production safety.
    console.info('[handle-sms-reply] non-STOP/START message ignored');
    return twimlResponse(COMMANDS_DISABLED_MESSAGE);
  } catch (error: unknown) {
    console.error('Error in handle-sms-reply:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
