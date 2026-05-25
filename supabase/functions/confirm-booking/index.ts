import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://esm.sh/zod@3.23.8";
import { normalizePhoneToE164 } from "../shared/phoneNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  slotId: z.string().min(1, "slotId is required"),
  action: z.enum(["approve", "reject"]),
});

type ConfirmAction = z.infer<typeof requestSchema>["action"];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const formatTimeWindow = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dateStr = start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const startTime = start.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return { dateStr, timeStr: `${startTime} - ${endTime}` };
};

const isLocalhostUrl = (value: string): boolean => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
};

const normalizeNonLocalBaseUrl = (value: string | null): string | null => {
  if (!value || !/^https?:\/\//.test(value)) return null;
  const normalized = value.replace(/\/+$/, "");
  return isLocalhostUrl(normalized) ? null : normalized;
};

const resolveAppBaseUrl = (req: Request): string | null => {
  const configuredBaseUrl = normalizeNonLocalBaseUrl(
    Deno.env.get("APP_BASE_URL") || Deno.env.get("PUBLIC_APP_URL"),
  );
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const origin = normalizeNonLocalBaseUrl(req.headers.get("origin"));
  if (origin) {
    return origin;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refererOrigin = normalizeNonLocalBaseUrl(new URL(referer).origin);
      if (refererOrigin) {
        return refererOrigin;
      }
    } catch {
      // Fall through to forwarded host/proto.
    }
  }

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (forwardedProto && forwardedHost) {
    const forwardedBase = normalizeNonLocalBaseUrl(`${forwardedProto}://${forwardedHost}`);
    if (forwardedBase) {
      return forwardedBase;
    }
  }

  return null;
};

const sendSms = async ({
  supabaseUrl,
  serviceRoleKey,
  to,
  message,
  merchantId,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  to: string;
  message: string;
  merchantId: string;
}) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      to,
      message,
      merchant_id: merchantId,
    }),
  });

  if (!response.ok) {
    let errorDetail = `send-sms failed (${response.status})`;

    try {
      const errorJson = await response.json();
      if (errorJson?.error) {
        errorDetail = String(errorJson.error);
      }
    } catch {
      const errorText = await response.text();
      if (errorText) {
        errorDetail = errorText;
      }
    }

    throw new Error(errorDetail);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(
        { error: "Missing required Supabase environment variables" },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("[confirm-booking] Missing authorization header");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      console.warn("[confirm-booking] Empty bearer token");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const parsedRequest = requestSchema.safeParse(requestBody);
    if (!parsedRequest.success) {
      return jsonResponse(
        {
          error: "Invalid request payload",
          details: parsedRequest.error.flatten(),
        },
        400,
      );
    }

    const { slotId, action } = parsedRequest.data;

    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await serviceRoleClient.auth.getUser(jwt);

    if (userError || !user) {
      console.warn("[confirm-booking] Token verification failed", {
        hasUser: Boolean(user),
        error: userError?.message ?? "unknown",
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: slot, error: slotError } = await serviceRoleClient
      .from("slots")
      .select(
        "id, merchant_id, status, consumer_phone, booked_by_name, booked_by_consumer_id, start_time, end_time, appointment_name",
      )
      .eq("id", slotId)
      .maybeSingle();

    if (slotError) {
      return jsonResponse({ error: slotError.message }, 500);
    }

    if (!slot) {
      return jsonResponse({ error: "Slot not found" }, 404);
    }

    if (slot.merchant_id !== user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (slot.status !== "pending_confirmation") {
      return jsonResponse(
        { error: "Slot is not pending confirmation", code: "not_pending" },
        409,
      );
    }

    const consumerPhone = slot.consumer_phone;
    const consumerName = slot.booked_by_name?.trim() || "there";

    const { data: profile } = await serviceRoleClient
      .from("profiles")
      .select("business_name")
      .eq("id", slot.merchant_id)
      .maybeSingle();

    const businessName = profile?.business_name?.trim() || "the business";
    const { dateStr, timeStr } = formatTimeWindow(slot.start_time, slot.end_time);
    const appointmentPart = slot.appointment_name
      ? ` for ${slot.appointment_name}`
      : "";
    const appBaseUrl = resolveAppBaseUrl(req);
    const appointmentDetailsUrl = appBaseUrl
      ? `${appBaseUrl}/booking-confirmed/${slot.id}`
      : null;
    const detailsLinkPart = appointmentDetailsUrl
      ? ` View details: ${appointmentDetailsUrl}`
      : "";

    const nextStatus = action === "approve" ? "booked" : "open";
    const updatePayload: Record<string, string | null> = { status: nextStatus };

    if (action === "reject") {
      updatePayload.booked_by_name = null;
      updatePayload.consumer_phone = null;
      updatePayload.booked_by_consumer_id = null;
    }

    const { data: updatedSlot, error: updateError } = await serviceRoleClient
      .from("slots")
      .update(updatePayload)
      .eq("id", slotId)
      .eq("status", "pending_confirmation")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    if (!updatedSlot) {
      return jsonResponse(
        { error: "Slot is not pending confirmation", code: "not_pending" },
        409,
      );
    }

    let notificationSent = true;
    let notificationError: string | null = null;

    if (!consumerPhone) {
      notificationSent = false;
      notificationError = "Missing consumer phone number";
    } else {
      try {
        const normalizedConsumerPhone = normalizePhoneToE164(consumerPhone);
        const consumerMessage = action === "approve"
          ? `Hi ${consumerName}, your booking request${appointmentPart} with ${businessName} for ${dateStr} at ${timeStr} is confirmed.${detailsLinkPart}`
          : `Hi ${consumerName}, ${businessName} could not confirm your booking request${appointmentPart} for ${dateStr} at ${timeStr}.`;

        await sendSms({
          supabaseUrl,
          serviceRoleKey: supabaseServiceRoleKey,
          to: normalizedConsumerPhone,
          message: consumerMessage,
          merchantId: slot.merchant_id,
        });
      } catch (error) {
        notificationSent = false;
        notificationError = error instanceof Error
          ? error.message
          : "Failed to notify consumer";
        console.error("[confirm-booking] Failed to notify consumer:", error);
      }
    }

    return jsonResponse({
      success: true,
      slotId,
      action: action as ConfirmAction,
      status: nextStatus,
      notificationSent,
      notificationError,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500,
    );
  }
});
