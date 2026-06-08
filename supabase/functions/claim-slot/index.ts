import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { normalizePhoneToE164 } from "../shared/phoneNormalization.ts";
import {
  formatSlotDateAndTimeRange,
  resolveOperationalTimeZone,
} from "../shared/smsTimeFormat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const resolveAppBaseUrl = (req: Request): string | null => {
  const origin = req.headers.get("origin");
  if (origin && /^https?:\/\//.test(origin)) {
    return origin.replace(/\/+$/, "");
  }

  const configuredBaseUrl = Deno.env.get("APP_BASE_URL") || Deno.env.get("PUBLIC_APP_URL");
  if (configuredBaseUrl && /^https?:\/\//.test(configuredBaseUrl)) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin.replace(/\/+$/, "");
    } catch {
      // Fall through to forwarded host/proto.
    }
  }

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
  }

  return null;
};

const sendSms = async ({
  supabaseUrl,
  supabaseServiceRoleKey,
  to,
  message,
  merchantId,
}: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  to: string;
  message: string;
  merchantId: string;
}) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
    body: JSON.stringify({
      to,
      message,
      merchant_id: merchantId,
    }),
  });

  if (!response.ok) {
    let errorMessage = `send-sms failed (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error) {
        errorMessage = String(errorJson.error);
      }
    } catch {
      const errorText = await response.text();
      if (errorText) {
        errorMessage = errorText;
      }
    }
    throw new Error(errorMessage);
  }
};

type MerchantSmsRoute = {
  to: string;
  source: "location" | "profile_fallback";
};

const resolveMerchantSmsRoute = async ({
  supabase,
  merchantId,
  locationId,
}: {
  supabase: ReturnType<typeof createClient>;
  merchantId: string;
  locationId: string | null;
}): Promise<MerchantSmsRoute> => {
  if (locationId) {
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("phone")
      .eq("id", locationId)
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (locationError) {
      console.warn("[claim-slot] Failed location phone lookup", {
        merchantId,
        locationId,
        error: locationError.message,
      });
    } else if (location?.phone) {
      try {
        return {
          to: normalizePhoneToE164(location.phone),
          source: "location",
        };
      } catch (error) {
        console.warn("[claim-slot] Invalid location phone; falling back to profile phone", {
          merchantId,
          locationId,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", merchantId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile?.phone) {
    throw new Error("Merchant phone is missing on both location and profile");
  }

  return {
    to: normalizePhoneToE164(profile.phone),
    source: "profile_fallback",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slotId, consumerName, consumerPhone, targetStatus } = await req.json();

    if (!slotId || !consumerName || !consumerPhone) {
      return jsonResponse({ error: "Missing required fields", code: "missing_params" }, 400);
    }

    const normalizedPhone = normalizePhoneToE164(consumerPhone);
    const desiredStatus = targetStatus === "pending_confirmation"
      ? "pending_confirmation"
      : targetStatus === "pending_external_booking"
      ? "pending_external_booking"
      : "booked";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: slot, error: slotError } = await supabase
      .from("slots")
      .select("id, merchant_id, location_id, start_time, end_time, appointment_name, status, consumer_phone")
      .eq("id", slotId)
      .is("deleted_at", null)
      .single();

    if (slotError || !slot) {
      return jsonResponse({ error: "Slot not found", code: "slot_not_found" }, 404);
    }

    const isExternalBookingFinalize =
      slot.status === "pending_external_booking" && desiredStatus === "booked";

    if (!["open", "notified", "held"].includes(slot.status) && !isExternalBookingFinalize) {
      return jsonResponse({ error: "Slot unavailable", code: "slot_unavailable" }, 409);
    }

    if (isExternalBookingFinalize && slot.consumer_phone !== normalizedPhone) {
      return jsonResponse({ error: "Slot unavailable", code: "slot_unavailable" }, 409);
    }

    if (new Date(slot.start_time) < new Date()) {
      return jsonResponse({ error: "Slot expired", code: "slot_expired" }, 409);
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
        return jsonResponse({ error: consumerError.message, code: "consumer_create_failed" }, 500);
      }

      consumerId = newConsumer?.id || null;
    }

    let updateQuery = supabase
      .from("slots")
      .update({
        status: desiredStatus,
        booked_by_name: consumerName.trim(),
        consumer_phone: normalizedPhone,
        booked_by_consumer_id: consumerId,
      })
      .eq("id", slotId);

    if (isExternalBookingFinalize) {
      updateQuery = updateQuery
        .eq("status", "pending_external_booking")
        .eq("consumer_phone", normalizedPhone);
    } else {
      updateQuery = updateQuery.in("status", ["open", "notified", "held"]);
    }

    const { data: updatedSlot, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle();

    if (updateError) {
      return jsonResponse({ error: updateError.message, code: "booking_update_failed" }, 500);
    }

    if (!updatedSlot) {
      return jsonResponse({ error: "Slot unavailable", code: "slot_unavailable" }, 409);
    }

    let merchantNotified = true;
    let merchantNotificationError: string | null = null;
    let bookingNotificationsEnabled = false;

    if (desiredStatus === "booked") {
      const { data: merchantProfile, error: merchantProfileError } = await supabase
        .from("profiles")
        .select("booking_notifications_enabled")
        .eq("id", slot.merchant_id)
        .maybeSingle();

      if (merchantProfileError) {
        console.warn("[claim-slot] Failed to read booking_notifications_enabled", {
          merchantId: slot.merchant_id,
          error: merchantProfileError.message,
        });
      } else {
        bookingNotificationsEnabled = Boolean(merchantProfile?.booking_notifications_enabled);
      }
    }

    const shouldNotifyMerchant =
      desiredStatus === "pending_confirmation" ||
      (desiredStatus === "booked" && bookingNotificationsEnabled);

    if (shouldNotifyMerchant) {
      try {
        const merchantSmsRoute = await resolveMerchantSmsRoute({
          supabase,
          merchantId: slot.merchant_id,
          locationId: slot.location_id ?? null,
        });
        console.log("[claim-slot] merchant_sms_route", {
          merchantId: slot.merchant_id,
          locationId: slot.location_id ?? null,
          source: merchantSmsRoute.source,
        });

        const baseUrl = resolveAppBaseUrl(req);
        const operationalTimeZone = await resolveOperationalTimeZone({
          supabase,
          merchantId: slot.merchant_id,
          locationId: slot.location_id ?? null,
        });
        const { dateLabel, timeRangeLabel } = formatSlotDateAndTimeRange({
          startIso: slot.start_time,
          endIso: slot.end_time,
          timeZone: operationalTimeZone,
        });
        const appointmentPrefix = slot.appointment_name ? `${slot.appointment_name} - ` : "";
        const trimmedConsumerName = consumerName.trim();
        let merchantMessage: string;

        if (desiredStatus === "pending_confirmation") {
          if (!baseUrl) {
            throw new Error("Unable to resolve app base URL for approval link");
          }
          const approvalUrl = `${baseUrl}/merchant/openings?approve=${slotId}`;
          merchantMessage =
            `${trimmedConsumerName} wants to book ${appointmentPrefix}${dateLabel}, ${timeRangeLabel}. ` +
            `Approve or reject here: ${approvalUrl}`;
        } else {
          const openingsUrl = baseUrl ? `${baseUrl}/merchant/openings` : null;
          merchantMessage =
            `${trimmedConsumerName} booked ${appointmentPrefix}${dateLabel}, ${timeRangeLabel}.` +
            (openingsUrl ? ` View details: ${openingsUrl}` : "");
        }

        await sendSms({
          supabaseUrl,
          supabaseServiceRoleKey: supabaseKey,
          to: merchantSmsRoute.to,
          message: merchantMessage,
          merchantId: slot.merchant_id,
        });
      } catch (notifyError) {
        merchantNotified = false;
        console.warn("[claim-slot] merchant_sms_route", {
          merchantId: slot.merchant_id,
          locationId: slot.location_id ?? null,
          source: "none",
          reason: notifyError instanceof Error ? notifyError.message : "unknown_error",
        });
        merchantNotificationError = notifyError instanceof Error
          ? notifyError.message
          : "Failed to notify merchant";
        console.error("[claim-slot] Failed to notify merchant:", notifyError);
      }
    }

    return jsonResponse(
      {
        success: true,
        slotId,
        consumerId,
        merchantNotified,
        merchantNotificationError,
      },
      200,
    );
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        code: "internal_error",
      },
      500,
    );
  }
});
