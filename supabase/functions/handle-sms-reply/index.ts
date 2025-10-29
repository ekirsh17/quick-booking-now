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
    const from = formData.get('From')?.toString(); // Merchant phone
    const body = formData.get('Body')?.toString()?.trim().toLowerCase(); // Message body

    if (!from || !body) {
      return new Response('Invalid request', { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

      return new Response('Booking approved', { status: 200 });
    }

    return new Response('Command not recognized', { status: 200 });
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
