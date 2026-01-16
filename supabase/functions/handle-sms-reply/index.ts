import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DateTime } from "https://esm.sh/luxon@3.4.4";
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
        "Welcome back! Visit a business's NotifyMe page to sign up for availability notifications."
      );

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Resubscribed successfully</Message></Response>',
        { 
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        }
      );
    }

    // Handle YES/NO for email cancellation confirmations
    if (body === 'yes' || body === 'y' || body === 'no' || body === 'n') {
      const { data: merchant } = await supabase
        .from('profiles')
        .select('id, phone, time_zone')
        .eq('phone', from)
        .maybeSingle();

      if (!merchant) {
        return new Response('Merchant not found', { status: 404 });
      }

      const { data: confirmations } = await supabase
        .from('email_opening_confirmations')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      const confirmation = confirmations?.[0];

      if (!confirmation) {
        await sendSMS(from, "You don't have any pending cancellation confirmations.");
        return new Response('No pending confirmations', { status: 200 });
      }

      if (body === 'no' || body === 'n') {
        await supabase
          .from('email_opening_confirmations')
          .update({ status: 'denied', denied_at: new Date().toISOString() })
          .eq('id', confirmation.id);

        await sendSMS(from, "Got it. The opening was not created.");
        return new Response('Denied', { status: 200 });
      }

      try {
        await createOpeningFromConfirmation(supabase, merchant.id, confirmation);

        await supabase
          .from('email_opening_confirmations')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', confirmation.id);

        const localStart = DateTime.fromISO(confirmation.start_time).setZone(merchant.time_zone || 'America/New_York');
        const timeLabel = localStart.toFormat('EEE, MMM d · h:mm a');
        await sendSMS(from, `Opening created for ${timeLabel}.`);
        return new Response('Confirmed', { status: 200 });
      } catch (error: any) {
        console.error('[handle-sms-reply] Failed to create opening:', error);
        await sendSMS(from, "Unable to create the opening due to a conflict. Please check your schedule.");
        return new Response('Conflict', { status: 200 });
      }
    }

    // Check if message is "confirm" or "approve"
    if (body === 'confirm' || body === 'approve') {
      // Find merchant by phone
      const { data: merchant } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', from)
        .single();

      if (!merchant) {
        return new Response('Merchant not found', { status: 404 });
      }

      // Find the most recent pending_confirmation slot for this merchant
      const { data: slots } = await supabase
        .from('slots')
        .select('id, consumer_phone, booked_by_name, start_time, end_time')
        .eq('merchant_id', merchant.id)
        .eq('status', 'pending_confirmation')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!slots || slots.length === 0) {
        // No pending slots
        await sendSMS(from, "You don't have any pending bookings to confirm.");
        return new Response('No pending bookings', { status: 200 });
      }

      const slot = slots[0];

      // Approve the booking
      await supabase
        .from('slots')
        .update({ status: 'booked' })
        .eq('id', slot.id);

      // Send confirmation to consumer
      const startTime = new Date(slot.start_time);
      const endTime = new Date(slot.end_time);
      const timeStr = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      
      await sendSMS(
        slot.consumer_phone,
        `✅ Your booking for ${timeStr} has been confirmed! See you there.`
      );

      // Confirm to merchant
      await sendSMS(
        from,
        `Booking confirmed for ${slot.booked_by_name} at ${timeStr}.`
      );

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Booking confirmed!</Message></Response>',
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
  } catch (error: any) {
    console.error('Error in handle-sms-reply:', error);
    return new Response(JSON.stringify({ error: error.message }), {
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

async function createOpeningFromConfirmation(supabase: any, merchantId: string, confirmation: any) {
  // Allow overlapping openings for future multi-chair support.

  const durationMinutes = typeof confirmation.duration_minutes === 'number' && confirmation.duration_minutes > 0
    ? confirmation.duration_minutes
    : Math.round(
      (new Date(confirmation.end_time).getTime() - new Date(confirmation.start_time).getTime()) / (1000 * 60)
    );
  const startTime = new Date(confirmation.start_time);
  const endTime = confirmation.duration_source === 'range'
    ? new Date(confirmation.end_time)
    : new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const { error } = await supabase
    .from('slots')
    .insert({
      merchant_id: merchantId,
      staff_id: null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      appointment_name: confirmation.appointment_name,
      status: 'open',
      created_via: 'email'
    });

  if (error) throw error;
}

serve(handler);
