import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse Twilio webhook payload
    const formData = await req.formData();
    const from = formData.get('From')?.toString(); // Sender phone
    const messageBody = formData.get('Body')?.toString()?.trim(); // Message body
    const messageSid = formData.get('MessageSid')?.toString();

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

serve(handler);
