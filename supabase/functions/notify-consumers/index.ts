import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSlotSignature, buildBookingUrl, type SlotLinkParams } from "../shared/slotSigning.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyConsumersRequest {
  slotId: string;
  merchantId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slotId, merchantId }: NotifyConsumersRequest = await req.json();
    
    console.log('Notifying consumers for slot:', slotId);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get slot details with merchant profile
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*, profiles!merchant_id(business_name, time_zone)')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      throw new Error('Slot not found');
    }

    // Extract profile data (handle array from join)
    const merchantProfile = Array.isArray(slot.profiles) ? slot.profiles[0] : slot.profiles;
    if (!merchantProfile) {
      throw new Error('Merchant profile not found');
    }

    // Get notify requests for this merchant
    const { data: requests, error: requestsError } = await supabase
      .from('notify_requests')
      .select('*, consumers!inner(*)')
      .eq('merchant_id', merchantId);

    if (requestsError) {
      throw new Error('Failed to fetch notify requests');
    }

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No consumers to notify',
          notified: 0 
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Filter requests by time_range to match consumer's requested timeframe
    const slotStartDate = new Date(slot.start_time);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setDate(monthEnd.getDate() + 30);

    const filteredRequests = requests.filter((req: any) => {
      switch (req.time_range) {
        case 'today':
          return slotStartDate >= today && slotStartDate < tomorrow;
        case 'tomorrow':
          return slotStartDate >= tomorrow && slotStartDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
        case 'this_week':
          return slotStartDate >= today && slotStartDate < weekEnd;
        case 'next_week':
          const nextWeekStart = new Date(weekEnd);
          const nextWeekEnd = new Date(weekEnd);
          nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
          return slotStartDate >= nextWeekStart && slotStartDate < nextWeekEnd;
        case 'anytime':
          return true;
        default:
          return true;
      }
    });

    if (filteredRequests.length === 0) {
      console.log(`No consumers matched time_range filter for slot at ${slot.start_time}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No consumers to notify (filtered by time_range)',
          notified: 0 
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format slot time in merchant's timezone
    const slotDate = new Date(slot.start_time);
    const merchantTz = merchantProfile.time_zone || 'America/New_York';
    
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: merchantTz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: merchantTz,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    const timeString = timeFormatter.format(slotDate);
    const dateString = dateFormatter.format(slotDate);

    // Deduplicate consumers by phone number to prevent multiple SMS
    const uniqueConsumers = new Map();
    filteredRequests.forEach((request: any) => {
      const phone = request.consumers.phone;
      // Keep the first occurrence of each phone number
      if (!uniqueConsumers.has(phone)) {
        uniqueConsumers.set(phone, request);
      }
    });

    const deduplicatedRequests = Array.from(uniqueConsumers.values());

    console.log(`Original requests: ${requests.length}, Filtered: ${filteredRequests.length}, Deduplicated: ${deduplicatedRequests.length}`);

    // Generate signed booking URL
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://your-app-url.com';
    
    const linkParams: SlotLinkParams = {
      slotId: slot.id,
      startsAtUtc: new Date(slot.start_time).toISOString(),
      durationMin: slot.duration_minutes,
      locationTz: merchantTz
    };

    const signature = await generateSlotSignature(linkParams);
    const bookingUrl = buildBookingUrl(baseUrl, merchantId, linkParams, signature);

    console.log('Generated signed booking URL for notifications');

    // Send SMS to each unique consumer
    const notificationPromises = deduplicatedRequests.map(async (request: any) => {
      const consumer = request.consumers;
      const message = `${merchantProfile.business_name}: A ${timeString} spot on ${dateString} just opened! Book now: ${bookingUrl}\n\nReply STOP to unsubscribe`;

      try {
        // Check if notification already sent to prevent duplicates
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('slot_id', slotId)
          .eq('consumer_id', consumer.id)
          .single();

        if (existingNotification) {
          console.log(`Already notified consumer ${consumer.phone} about slot ${slotId}`);
          return consumer.id; // Count as success, already notified
        }

        // Call send-sms edge function
        console.log(`Sending SMS to ${consumer.phone} for slot ${slotId}`);
        const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            to: consumer.phone,
            message: message,
          }),
        });

        const smsResult = await smsResponse.json();

        if (!smsResponse.ok) {
          console.error('Failed to send SMS to:', consumer.phone, 'Error:', smsResult);
          return null;
        }

        console.log(`SMS sent successfully to ${consumer.phone}:`, smsResult.messageSid);

        // Create notification record
        const { error: insertError } = await supabase.from('notifications').insert({
          slot_id: slotId,
          consumer_id: consumer.id,
          merchant_id: merchantId,
          status: 'sent',
        });

        if (insertError) {
          console.error('Failed to insert notification record:', insertError);
          // SMS was sent, so still return success
          return consumer.id;
        }

        return consumer.id;
      } catch (error) {
        console.error('Error sending notification to:', consumer.phone, error);
        return null;
      }
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r !== null).length;

    console.log(`Notified ${successCount} consumers`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: successCount,
        total: requests.length 
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in notify-consumers function:', error);
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
