import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifySlotSignature, type SlotLinkParams } from "../shared/slotSigning.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slotId = url.searchParams.get('slotId');
    const st = url.searchParams.get('st');
    const tz = url.searchParams.get('tz');
    const dur = url.searchParams.get('dur');
    const sig = url.searchParams.get('sig');

    if (!slotId || !st || !tz || !dur || !sig) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters',
          code: 'missing_params'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const durationMin = parseInt(dur, 10);
    if (isNaN(durationMin)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid duration',
          code: 'invalid_duration'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const params: SlotLinkParams = {
      slotId,
      startsAtUtc: st,
      durationMin,
      locationTz: tz,
    };

    const isValid = await verifySlotSignature(params, sig);
    if (!isValid) {
      console.warn('Invalid signature attempt:', { slotId, st });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or tampered link',
          code: 'invalid_signature'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch slot from database
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
        profiles!merchant_id(business_name, time_zone)
      `)
      .eq('id', slotId)
      .is('deleted_at', null)
      .single();

    if (slotError || !slot) {
      console.error('Slot not found:', slotError);
      return new Response(
        JSON.stringify({ 
          error: 'Slot not found',
          code: 'slot_not_found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract profile data (handle array from join)
    const profile = Array.isArray(slot.profiles) ? slot.profiles[0] : slot.profiles;
    
    if (!profile) {
      return new Response(
        JSON.stringify({ 
          error: 'Merchant profile not found',
          code: 'profile_not_found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify slot parameters match signature
    const slotStartUtc = new Date(slot.start_time).toISOString();
    if (slotStartUtc !== st || slot.duration_minutes !== durationMin) {
      console.warn('Slot parameter mismatch:', { 
        expected: { st: slotStartUtc, dur: slot.duration_minutes },
        received: { st, dur: durationMin }
      });
      return new Response(
        JSON.stringify({ 
          error: 'Slot parameters do not match',
          code: 'slot_mismatch'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if slot is still available
    if (slot.status !== 'open') {
      // Fetch next 3 available slots for alternatives
      const { data: alternatives } = await supabase
        .from('slots')
        .select('id, start_time, end_time, duration_minutes, appointment_name')
        .eq('merchant_id', slot.merchant_id)
        .eq('status', 'open')
        .is('deleted_at', null)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(3);

      return new Response(
        JSON.stringify({ 
          error: 'Slot no longer available',
          code: 'slot_unavailable',
          alternatives: alternatives || []
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format display time in merchant's timezone
    const startDate = new Date(slot.start_time);
    const endDate = new Date(slot.end_time);
    
    // Use Intl.DateTimeFormat for proper timezone formatting
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    const startTimeLocal = timeFormatter.format(startDate);
    const endTimeLocal = timeFormatter.format(endDate);
    const dateLocal = dateFormatter.format(startDate);
    
    const displayLabel = `${dateLocal} · ${startTimeLocal}–${endTimeLocal}`;

    // Return resolved slot data
    return new Response(
      JSON.stringify({
        slotId: slot.id,
        merchantId: slot.merchant_id,
        startsAtUtc: slotStartUtc,
        endsAtUtc: new Date(slot.end_time).toISOString(),
        durationMin: slot.duration_minutes,
        locationTz: tz,
        businessName: profile.business_name,
        appointmentName: slot.appointment_name,
        display: {
          localStart: startDate.toISOString(),
          label: displayLabel
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in resolve-slot:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'internal_error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
