import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildSlotWindowContext,
  slotMatchesNotifyRequest,
} from '../shared/notifyRequestTime.ts';

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

interface NotifyRequestConsumer {
  id: string;
  phone: string;
}

interface NotifyRequestRow {
  id: string;
  time_range: string;
  created_at: string;
  staff_id: string | null;
  location_id: string | null;
  consumers: NotifyRequestConsumer;
}

interface SendSmsResult {
  messageSid?: string;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const LOG_VERSION = 'notify-consumers v2026-06-notify-time-shared';

  try {
    const { slotId, merchantId }: NotifyConsumersRequest = await req.json();
    
    console.log('=== NOTIFY CONSUMERS START ===');
    console.log('Version:', LOG_VERSION);
    console.log('Slot ID:', slotId);
    console.log('Merchant ID:', merchantId);

    if (!supabaseUrl || !supabaseKey) {
      console.error('[notify-consumers] Missing required environment variables');
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get slot details with merchant profile
    // Use explicit columns instead of * to avoid join issues (matches resolve-slot pattern)
    // Note: Only select business_name (not name) since name column doesn't exist in join
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select(`
        id,
        merchant_id,
        start_time,
        end_time,
        duration_minutes,
        status,
        appointment_name,
        staff_id,
        location_id,
        profiles!merchant_id(business_name, time_zone),
        staff:staff_id(name)
      `)
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
    
    // Use business_name as fallback if name is null
    const merchantName = merchantProfile.name || merchantProfile.business_name || 'A business';
    console.log('Merchant profile found:', merchantName, 'Timezone:', merchantProfile.time_zone);

    const staffRecord = Array.isArray(slot.staff) ? slot.staff[0] : slot.staff;
    const staffName = staffRecord?.name || null;

    // Get notify requests for this merchant
    const { data: requests, error: requestsError } = await supabase
      .from('notify_requests')
      .select('*, consumers!inner(*)')
      .eq('merchant_id', merchantId);

    if (requestsError) {
      console.error('Failed to fetch notify requests:', requestsError);
      console.error('Error details:', JSON.stringify(requestsError, null, 2));
      throw new Error(`Failed to fetch notify requests: ${requestsError.message || 'Unknown error'}`);
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

    const slotStartDate = new Date(slot.start_time);
    const merchantTz = merchantProfile.time_zone || 'America/New_York';
    const slotWindow = buildSlotWindowContext(slotStartDate, merchantTz);

    console.log(`=== DATE FILTERING (${merchantTz}) ===`);
    console.log('Slot start time (UTC):', slotStartDate.toISOString());
    console.log('Slot date key:', slotWindow.slotDateKey);

    const requestRows = (requests ?? []) as NotifyRequestRow[];
    const filteredRequests = requestRows.filter((req) => {
      const timeRange = req.time_range;
      const createdAt = req.created_at;
      if (typeof timeRange !== 'string' || !createdAt) {
        return false;
      }

      const matches = slotMatchesNotifyRequest(timeRange, createdAt, merchantTz, slotWindow);

      if (!matches) {
        console.log(`Request ${req.id} (time_range: ${req.time_range}, phone: ${req.consumers?.phone?.substring(0, 5)}***): ❌ NO MATCH (time)`);
        return false;
      }

      const requestStaffId = req.staff_id || null;
      const slotStaffId = slot.staff_id || null;

      let staffMatches = true;
      if (requestStaffId) {
        if (!slotStaffId) {
          console.log(`Request ${req.id} skipped: slot has no staff but request is staff-specific.`);
          staffMatches = false;
        } else {
          staffMatches = requestStaffId === slotStaffId;
          if (!staffMatches) {
            console.log(`Request ${req.id} skipped: staff mismatch (${requestStaffId} != ${slotStaffId}).`);
          }
        }
      }

      if (!staffMatches) return false;

      const slotLocationId = slot.location_id || null;
      const requestLocationId = req.location_id || null;

      if (slotLocationId && requestLocationId && slotLocationId !== requestLocationId) {
        console.log(`Request ${req.id} skipped: location mismatch (${requestLocationId} != ${slotLocationId}).`);
        return false;
      }

      return true;
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

    // Format slot time in merchant's timezone for display in SMS
    const slotDateForDisplay = new Date(slot.start_time);
    
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

    const timeString = timeFormatter.format(slotDateForDisplay);
    const dateString = dateFormatter.format(slotDateForDisplay);

    // Deduplicate consumers by phone number to prevent multiple SMS
    const uniqueConsumers = new Map<string, NotifyRequestRow>();
    filteredRequests.forEach((request) => {
      const consumer = request.consumers;
      if (!consumer || !consumer.phone) {
        console.warn('Skipping request with missing consumer or phone:', request.id);
        return;
      }
      const phone = consumer.phone;
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
    
    // Use simple URL for now (slot signing temporarily disabled)
    const bookingUrl = `${baseUrl}/claim/${slot.id}`;
    console.log('[notify-consumers] Generated booking URL:', bookingUrl);

    // Send SMS to each unique consumer
    console.log(`=== CREATING SMS PROMISES FOR ${deduplicatedRequests.length} CONSUMERS ===`);
    const notificationPromises = deduplicatedRequests.map(async (request: NotifyRequestRow, index: number) => {
      const consumer = request.consumers;
      const message = staffName
        ? `${merchantName}: ${staffName} has a ${timeString} spot on ${dateString}! Book now: ${bookingUrl}`
        : `${merchantName}: A ${timeString} spot on ${dateString} just opened! Book now: ${bookingUrl}`;

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
        let smsResult: SendSmsResult | null = null;

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
            smsResult = (await smsResponse.json()) as SendSmsResult;
          } catch (jsonError) {
            const textError = await smsResponse.text();
            console.error(`[${index + 1}/${deduplicatedRequests.length}] Failed to parse SMS response JSON. Status:`, smsResponse.status, 'Response:', textError);
            throw new Error(`send-sms returned invalid JSON: ${textError.substring(0, 200)}`);
          }

          if (!smsResponse.ok) {
            console.error(`[${index + 1}/${deduplicatedRequests.length}] send-sms returned error. Status:`, smsResponse.status, 'Error:', smsResult);
            // Log error but don't throw - let it return null to count as failed notification
            console.error(`[${index + 1}/${deduplicatedRequests.length}] SMS sending failed. Check send-sms function logs for details.`);
            return null;
          }
        } catch (smsError: unknown) {
          console.error(`[${index + 1}/${deduplicatedRequests.length}] Error calling send-sms function:`, smsError);
          console.error(`[${index + 1}/${deduplicatedRequests.length}] SMS sending failed. Check send-sms function configuration and logs.`);
          // Return null to count as failed notification (fallback logic removed - keep it in send-sms only)
          return null;
        }

        console.log(`[${index + 1}/${deduplicatedRequests.length}] === SMS SENT SUCCESSFULLY ===`);
        console.log(`Phone: ${consumer.phone}`);
        console.log(`Twilio Message SID: ${smsResult?.messageSid ?? "unknown"}`);
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('=== ERROR IN NOTIFY-CONSUMERS FUNCTION ===');
    console.error('Error type:', err.constructor?.name || typeof error);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2));

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
