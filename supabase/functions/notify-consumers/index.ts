import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    
    console.log('=== NOTIFY CONSUMERS START ===');
    console.log('Slot ID:', slotId);
    console.log('Merchant ID:', merchantId);

    if (!supabaseUrl || !supabaseKey) {
      console.error('[notify-consumers] Missing required environment variables');
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get slot details with merchant profile
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*, profiles!merchant_id(name, time_zone)')
      .eq('id', slotId)
      .single();

    if (slotError) {
      console.error('Slot query error:', slotError);
      throw new Error(`Slot not found: ${slotError.message}`);
    }
    if (!slot) {
      console.error('Slot is null');
      throw new Error('Slot not found');
    }
    console.log('Slot found:', slot.id, 'Start time:', slot.start_time);

    // Extract profile data (handle array from join)
    const merchantProfile = Array.isArray(slot.profiles) ? slot.profiles[0] : slot.profiles;
    if (!merchantProfile) {
      console.error('Merchant profile not found. Slot.profiles:', slot.profiles);
      throw new Error('Merchant profile not found');
    }
    console.log('Merchant profile found:', merchantProfile.name, 'Timezone:', merchantProfile.time_zone);

    // Get notify requests for this merchant
    const { data: requests, error: requestsError } = await supabase
      .from('notify_requests')
      .select('*, consumers!inner(*)')
      .eq('merchant_id', merchantId);

    if (requestsError) {
      console.error('Failed to fetch notify requests:', requestsError);
      throw new Error(`Failed to fetch notify requests: ${requestsError.message}`);
    }
    console.log('Found', requests?.length || 0, 'notify requests');

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
    // CRITICAL: Compare dates in merchant's timezone, not UTC
    const slotStartDate = new Date(slot.start_time);
    const merchantTz = merchantProfile.time_zone || 'America/New_York';
    const now = new Date();
    
    // Get today's date in merchant's timezone
    const todayInTz = new Intl.DateTimeFormat('en-CA', { 
      timeZone: merchantTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    
    // Get slot's date in merchant's timezone
    const slotDateInTz = new Intl.DateTimeFormat('en-CA', { 
      timeZone: merchantTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(slotStartDate);
    
    // Calculate tomorrow in merchant's timezone
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowInTz = new Intl.DateTimeFormat('en-CA', { 
      timeZone: merchantTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(tomorrowDate);
    
    // For week calculations, use Date objects with timezone-aware comparisons
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    console.log('=== DATE FILTERING DEBUG ===');
    console.log('Merchant timezone:', merchantTz);
    console.log('Slot start time (UTC):', slotStartDate.toISOString());
    console.log('Slot date (merchant TZ):', slotDateInTz);
    console.log('Today date (merchant TZ):', todayInTz);
    console.log('Tomorrow date (merchant TZ):', tomorrowInTz);
    console.log('Current time (UTC):', now.toISOString());
    
    const filteredRequests = requests.filter((req: any) => {
      const matches = (() => {
        switch (req.time_range) {
          case 'today':
            // Compare date strings in merchant's timezone
            const matchesToday = slotDateInTz === todayInTz;
            console.log(`  Checking 'today': slotDate=${slotDateInTz}, todayDate=${todayInTz}, match=${matchesToday}`);
            return matchesToday;
          case 'tomorrow':
            const matchesTomorrow = slotDateInTz === tomorrowInTz;
            console.log(`  Checking 'tomorrow': slotDate=${slotDateInTz}, tomorrowDate=${tomorrowInTz}, match=${matchesTomorrow}`);
            return matchesTomorrow;
          case 'this_week':
            // For week, check if slot is within 7 days from today
            const slotDateObj = new Date(slotDateInTz + 'T00:00:00');
            const todayDateObj = new Date(todayInTz + 'T00:00:00');
            const weekEndDateObj = new Date(todayDateObj);
            weekEndDateObj.setDate(weekEndDateObj.getDate() + 7);
            const matchesWeek = slotDateObj >= todayDateObj && slotDateObj < weekEndDateObj;
            console.log(`  Checking 'this_week': slotDate=${slotDateInTz}, today=${todayInTz}, match=${matchesWeek}`);
            return matchesWeek;
          case 'next_week':
            const nextWeekStartDate = new Date(todayInTz + 'T00:00:00');
            nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 7);
            const nextWeekEndDate = new Date(nextWeekStartDate);
            nextWeekEndDate.setDate(nextWeekEndDate.getDate() + 7);
            const slotDateForNextWeek = new Date(slotDateInTz + 'T00:00:00');
            const matchesNextWeek = slotDateForNextWeek >= nextWeekStartDate && slotDateForNextWeek < nextWeekEndDate;
            console.log(`  Checking 'next_week': match=${matchesNextWeek}`);
            return matchesNextWeek;
          case 'anytime':
            console.log(`  Checking 'anytime': always matches`);
            return true;
          default:
            console.log(`  Unknown time_range '${req.time_range}': defaulting to true`);
            return true;
        }
      })();
      console.log(`Request ${req.id} (time_range: ${req.time_range}, phone: ${req.consumers?.phone}): ${matches ? '✅ MATCHES' : '❌ NO MATCH'}`);
      return matches;
    });
    
    console.log('Filtered to', filteredRequests.length, 'matching requests');

    if (filteredRequests.length === 0) {
      console.log(`=== NO CONSUMERS MATCHED TIME RANGE ===`);
      console.log(`Slot start time: ${slot.start_time}`);
      console.log(`Total requests: ${requests.length}`);
      console.log(`Filtered requests: 0`);
      console.log(`Date check - Slot: ${slotStartDate.toISOString()}, Today: ${today.toISOString()}, Tomorrow: ${tomorrow.toISOString()}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No consumers to notify (filtered by time_range)',
          notified: 0,
          debug: {
            totalRequests: requests.length,
            slotStartTime: slot.start_time,
            slotDate: slotStartDate.toISOString(),
            today: today.toISOString()
          }
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format slot time in merchant's timezone
    const slotDate = new Date(slot.start_time);
    // merchantTz is already declared above (line 91)
    
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

    console.log(`=== CONSUMER FILTERING RESULTS ===`);
    console.log(`Original requests: ${requests.length}`);
    console.log(`Filtered by time_range: ${filteredRequests.length}`);
    console.log(`After deduplication: ${deduplicatedRequests.length}`);
    
    if (deduplicatedRequests.length === 0) {
      console.log(`=== NO CONSUMERS TO NOTIFY AFTER DEDUPLICATION ===`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No consumers to notify (after deduplication)',
          notified: 0 
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    console.log(`=== STARTING SMS SENDING FOR ${deduplicatedRequests.length} CONSUMERS ===`);

    // Calculate duration from start and end times
    const slotStart = new Date(slot.start_time);
    const slotEnd = new Date(slot.end_time);
    const durationMin = Math.round((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60));

    // Generate booking URL
    // IMPORTANT: FRONTEND_URL should be set in Supabase Edge Function settings
    // For local dev: http://localhost:8080 (or your local IP for mobile testing)
    // For production: https://your-domain.com
    let baseUrl = Deno.env.get('FRONTEND_URL');
    
    if (!baseUrl) {
      console.warn('[notify-consumers] ⚠️ FRONTEND_URL not set in Supabase Edge Function settings!');
      console.warn('[notify-consumers] Using default: http://localhost:8080');
      console.warn('[notify-consumers] This will only work on your local computer, not on mobile devices.');
      console.warn('[notify-consumers] To fix: Set FRONTEND_URL in Supabase Dashboard > Edge Functions > notify-consumers > Settings > Secrets');
      baseUrl = 'http://localhost:8080'; // Match Vite default port
    }
    
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '');
    
    let bookingUrl: string;
    // Use simple URL for now (slot signing temporarily disabled)
    bookingUrl = `${baseUrl}/claim/${slot.id}`;
    console.log('[notify-consumers] Generated booking URL:', bookingUrl);

    // Send SMS to each unique consumer
    console.log(`=== CREATING SMS PROMISES FOR ${deduplicatedRequests.length} CONSUMERS ===`);
    const notificationPromises = deduplicatedRequests.map(async (request: any, index: number) => {
      const consumer = request.consumers;
      const message = `${merchantProfile.name || 'A business'}: A ${timeString} spot on ${dateString} just opened! Book now: ${bookingUrl}\n\nReply STOP to unsubscribe`;

      console.log(`[${index + 1}/${deduplicatedRequests.length}] Processing consumer: ${consumer.phone}`);
      
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
        console.log(`[${index + 1}/${deduplicatedRequests.length}] === CALLING SEND-SMS FUNCTION ===`);
        console.log(`Phone: ${consumer.phone}`);
        console.log(`Message length: ${message.length}`);
        console.log(`URL: ${supabaseUrl}/functions/v1/send-sms`);
        
        let smsResponse: Response;
        let smsResult: any;
        
        try {
          smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              to: consumer.phone,
              message: message,
              merchant_id: merchantId, // For multi-tenant SMS tracking
            }),
          });

          try {
            smsResult = await smsResponse.json();
          } catch (jsonError) {
            const textError = await smsResponse.text();
            console.error(`[${index + 1}/${deduplicatedRequests.length}] Failed to parse SMS response JSON. Status:`, smsResponse.status, 'Response:', textError);
            throw new Error(`send-sms returned invalid JSON: ${textError.substring(0, 200)}`);
          }

          if (!smsResponse.ok) {
            console.error(`[${index + 1}/${deduplicatedRequests.length}] send-sms returned error. Status:`, smsResponse.status, 'Error:', smsResult);
            throw new Error(`send-sms failed: ${smsResult?.error || 'Unknown error'}`);
          }
        } catch (smsError: any) {
          console.error(`[${index + 1}/${deduplicatedRequests.length}] Error calling send-sms function:`, smsError);
          
          // FALLBACK: Try direct Twilio call if send-sms fails
          console.log(`[${index + 1}/${deduplicatedRequests.length}] Attempting fallback: direct Twilio call`);
          try {
            const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
            const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
            const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
            const useDirectNumber = Deno.env.get('USE_DIRECT_NUMBER') === 'true';
            const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
            
            if (!twilioAccountSid || !twilioAuthToken) {
              console.error(`[${index + 1}/${deduplicatedRequests.length}] Cannot use fallback: Twilio credentials not available in notify-consumers`);
              return null;
            }
            
            // Normalize phone
            const e164Regex = /^\+[1-9]\d{1,14}$/;
            const normalized = consumer.phone.trim().replace(/[\s\-\(\)]/g, '');
            
            if (!e164Regex.test(normalized)) {
              console.error(`[${index + 1}/${deduplicatedRequests.length}] Invalid phone format for fallback:`, consumer.phone);
              return null;
            }
            
            // Build Twilio params
            const twilioParams: Record<string, string> = {
              To: normalized,
              Body: message,
            };
            
            if (useDirectNumber) {
              if (!twilioPhoneNumber) {
                console.error(`[${index + 1}/${deduplicatedRequests.length}] Fallback: USE_DIRECT_NUMBER=true but no phone number`);
                return null;
              }
              twilioParams.From = twilioPhoneNumber;
            } else {
              if (!messagingServiceSid) {
                console.error(`[${index + 1}/${deduplicatedRequests.length}] Fallback: USE_DIRECT_NUMBER=false but no messaging service SID`);
                return null;
              }
              twilioParams.MessagingServiceSid = messagingServiceSid;
            }
            
            // Call Twilio directly
            const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
            const twilioResponse = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(twilioParams),
              }
            );
            
            if (!twilioResponse.ok) {
              const errorText = await twilioResponse.text();
              console.error(`[${index + 1}/${deduplicatedRequests.length}] Fallback Twilio call failed:`, twilioResponse.status, errorText);
              return null;
            }
            
            const twilioData = await twilioResponse.json();
            console.log(`[${index + 1}/${deduplicatedRequests.length}] === FALLBACK SUCCESS: SMS SENT DIRECTLY TO TWILIO ===`);
            console.log(`Phone: ${consumer.phone}`);
            console.log(`Twilio Message SID: ${twilioData.sid}`);
            
            // Log to sms_logs for delivery tracking (fallback path)
            const { error: smsLogError } = await supabase.from('sms_logs').insert({
              message_sid: twilioData.sid,
              to_number: normalized,
              from_number: useDirectNumber ? twilioPhoneNumber : twilioData.from || twilioPhoneNumber,
              body: message,
              status: 'queued',
              direction: 'outbound',
              merchant_id: merchantId,
            });
            if (smsLogError) {
              console.warn(`[${index + 1}/${deduplicatedRequests.length}] Failed to log fallback SMS:`, smsLogError.message);
            }
            
            // Create notification record
            const { error: insertError } = await supabase.from('notifications').insert({
              slot_id: slotId,
              consumer_id: consumer.id,
              merchant_id: merchantId,
              status: 'sent',
            });

            if (insertError) {
              console.error('Failed to insert notification record:', insertError);
            }
            
            return consumer.id;
          } catch (fallbackError: any) {
            console.error(`[${index + 1}/${deduplicatedRequests.length}] Fallback also failed:`, fallbackError);
            return null;
          }
        }

        console.log(`[${index + 1}/${deduplicatedRequests.length}] === SMS SENT SUCCESSFULLY ===`);
        console.log(`Phone: ${consumer.phone}`);
        console.log(`Twilio Message SID: ${smsResult.messageSid}`);
        console.log(`Response:`, JSON.stringify(smsResult));

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

    console.log(`=== WAITING FOR ALL SMS PROMISES TO COMPLETE ===`);
    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r !== null).length;

    console.log(`=== SMS SENDING COMPLETE ===`);
    console.log(`Total consumers: ${deduplicatedRequests.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${deduplicatedRequests.length - successCount}`);

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
