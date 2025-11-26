import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  validateTwilioSignature, 
  parseTwilioFormData,
  getWebhookUrl 
} from '../shared/twilioValidation.ts';
import { mapTwilioStatus } from '../shared/smsStatus.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

// Set to true to skip signature validation in development
const SKIP_SIGNATURE_VALIDATION = Deno.env.get('SKIP_TWILIO_SIGNATURE_VALIDATION') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data first (needed for both validation and processing)
    const params = await parseTwilioFormData(req);
    
    // Validate Twilio signature
    if (!SKIP_SIGNATURE_VALIDATION) {
      if (!TWILIO_AUTH_TOKEN) {
        console.error('[Twilio Status Callback] TWILIO_AUTH_TOKEN not configured');
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
        console.warn('[Twilio Status Callback] Invalid signature - rejecting request');
        return new Response('Invalid signature', { status: 403 });
      }
      
      console.log('[Twilio Status Callback] Signature validated successfully');
    } else {
      console.warn('[Twilio Status Callback] Signature validation SKIPPED (dev mode)');
    }

    // Extract status callback data
    const MessageSid = params['MessageSid'];
    const MessageStatus = params['MessageStatus'];
    const ErrorCode = params['ErrorCode'];
    const ErrorMessage = params['ErrorMessage'];

    // Log without PII (mask phone numbers)
    const toNumber = params['To'];
    const maskedTo = toNumber ? `${toNumber.substring(0, 5)}***` : 'unknown';
    console.log('[Twilio Status Callback] Received:', { 
      MessageSid, 
      MessageStatus, 
      ErrorCode,
      to: maskedTo 
    });

    if (!MessageSid || !MessageStatus) {
      console.warn('[Twilio Status Callback] Missing MessageSid or MessageStatus');
      // Return 200 to prevent Twilio from retrying
      return new Response('Missing required fields', { 
        status: 200,
        headers: corsHeaders 
      });
    }

    // Map Twilio status to internal status
    const internalStatus = mapTwilioStatus(MessageStatus);

    // Update SMS log with delivery status
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: existingLog, error: lookupError } = await supabase
      .from('sms_logs')
      .select('id, status')
      .eq('message_sid', MessageSid)
      .single();

    if (lookupError) {
      // Log not found - this can happen if the message was sent before tracking was enabled
      console.warn(`[Twilio Status Callback] No SMS log found for MessageSid: ${MessageSid}`);
      // Return 200 to prevent Twilio from retrying - this is expected for old messages
      return new Response('OK', { 
        status: 200,
        headers: corsHeaders 
      });
    }

    // Update the log with new status
    const { error: updateError } = await supabase
      .from('sms_logs')
      .update({
        status: internalStatus,
        error_code: ErrorCode || null,
        error_message: ErrorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('message_sid', MessageSid);

    if (updateError) {
      console.error('[Twilio Status Callback] Failed to update SMS log:', updateError);
      // Still return 200 to prevent retry loops
      return new Response('Update failed', { 
        status: 200,
        headers: corsHeaders 
      });
    }

    console.log(`[Twilio Status Callback] Updated SMS log ${MessageSid}: ${existingLog.status} -> ${internalStatus}`);

    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });
  } catch (error: any) {
    console.error('[Twilio Status Callback] Error:', error.message);
    // Return 200 to prevent Twilio from endless retries on unexpected errors
    return new Response('Error processed', {
      status: 200,
      headers: corsHeaders,
    });
  }
};

serve(handler);
