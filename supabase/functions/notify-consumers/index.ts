import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Get slot details
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*, profiles!inner(business_name)')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      throw new Error('Slot not found');
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

    // Format slot time
    const startTime = new Date(slot.start_time);
    const timeStr = startTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });

    // Construct proper claim URL using project reference
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    const claimUrl = `https://${projectRef}.lovableproject.com/claim/${slotId}`;

    // Send SMS to each consumer
    const notificationPromises = requests.map(async (request: any) => {
      const consumer = request.consumers;
      const message = `🔔 ${slot.profiles.business_name} has a ${slot.duration_minutes}-min opening at ${timeStr}! Claim it now: ${claimUrl}`;

      try {
        // Call send-sms edge function
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

        if (!smsResponse.ok) {
          console.error('Failed to send SMS to:', consumer.phone);
          return null;
        }

        // Create notification record
        await supabase.from('notifications').insert({
          slot_id: slotId,
          consumer_id: consumer.id,
          merchant_id: merchantId,
          status: 'sent',
        });

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
