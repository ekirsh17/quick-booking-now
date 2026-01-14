import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { normalizePhoneToE164 } from "../shared/phoneNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slotId, consumerName, consumerPhone, targetStatus } = await req.json();

    if (!slotId || !consumerName || !consumerPhone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", code: "missing_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedPhone = normalizePhoneToE164(consumerPhone);
    const desiredStatus = targetStatus === "pending_confirmation" ? "pending_confirmation" : "booked";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: slot, error: slotError } = await supabase
      .from("slots")
      .select("id, start_time, status")
      .eq("id", slotId)
      .is("deleted_at", null)
      .single();

    if (slotError || !slot) {
      return new Response(
        JSON.stringify({ error: "Slot not found", code: "slot_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["open", "notified", "held"].includes(slot.status)) {
      return new Response(
        JSON.stringify({ error: "Slot unavailable", code: "slot_unavailable" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date(slot.start_time) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Slot expired", code: "slot_expired" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existingConsumer } = await supabase
      .from("consumers")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    let consumerId = existingConsumer?.id || null;
    if (!consumerId) {
      const { data: newConsumer, error: consumerError } = await supabase
        .from("consumers")
        .insert({
          name: consumerName.trim(),
          phone: normalizedPhone,
          saved_info: true,
        })
        .select("id")
        .single();

      if (consumerError) {
        return new Response(
          JSON.stringify({ error: consumerError.message, code: "consumer_create_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      consumerId = newConsumer?.id || null;
    }

    const bookingNotes = `booked_by:${consumerName.trim()}|phone:${normalizedPhone}|consumer_id:${consumerId || ""}`;

    const { error: updateError } = await supabase
      .from("slots")
      .update({
        status: desiredStatus,
        notes: bookingNotes,
      })
      .eq("id", slotId)
      .in("status", ["open", "notified", "held"]);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message, code: "booking_update_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, slotId, consumerId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        code: "internal_error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
