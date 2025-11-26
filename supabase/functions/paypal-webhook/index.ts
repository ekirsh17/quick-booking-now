/**
 * PayPal Webhook Handler
 * 
 * Handles PayPal webhook events for subscription management.
 * Events handled:
 * - BILLING.SUBSCRIPTION.ACTIVATED
 * - BILLING.SUBSCRIPTION.CANCELLED
 * - BILLING.SUBSCRIPTION.SUSPENDED
 * - BILLING.SUBSCRIPTION.PAYMENT.FAILED
 * - PAYMENT.SALE.COMPLETED
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") || "";
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") || "sandbox";

const PAYPAL_API_BASE = PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: {
    id: string;
    status?: string;
    custom_id?: string;
    subscriber?: {
      payer_id: string;
      email_address?: string;
    };
    billing_info?: {
      next_billing_time?: string;
      last_payment?: {
        amount?: {
          value: string;
          currency_code: string;
        };
        time?: string;
      };
    };
    start_time?: string;
  };
  create_time: string;
  summary?: string;
}

interface WebhookResponse {
  received: boolean;
  type?: string;
  error?: string;
}

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function verifyWebhookSignature(
  headers: Headers,
  body: string
): Promise<boolean> {
  // In production, you should verify the webhook signature
  // using PayPal's verification API
  if (!PAYPAL_WEBHOOK_ID) {
    console.warn("PayPal webhook ID not configured, skipping verification");
    return true;
  }

  try {
    const accessToken = await getPayPalAccessToken();
    
    const verifyResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers.get("paypal-auth-algo"),
          cert_url: headers.get("paypal-cert-url"),
          transmission_id: headers.get("paypal-transmission-id"),
          transmission_sig: headers.get("paypal-transmission-sig"),
          transmission_time: headers.get("paypal-transmission-time"),
          webhook_id: PAYPAL_WEBHOOK_ID,
          webhook_event: JSON.parse(body),
        }),
      }
    );

    if (!verifyResponse.ok) {
      console.error("PayPal webhook verification failed");
      return false;
    }

    const verifyData = await verifyResponse.json() as { verification_status: string };
    return verifyData.verification_status === "SUCCESS";
  } catch (error) {
    console.error("Error verifying PayPal webhook:", error);
    return false;
  }
}

async function logBillingEvent(
  eventType: string,
  providerEventId: string,
  payload: Record<string, unknown>,
  merchantId?: string,
  subscriptionId?: string,
  processed = true,
  error?: string
) {
  await supabase.from("billing_events").insert({
    event_type: eventType,
    provider: "paypal",
    provider_event_id: providerEventId,
    payload,
    merchant_id: merchantId,
    subscription_id: subscriptionId,
    processed,
    error,
  });
}

async function getMerchantByCustomId(customId: string): Promise<string | null> {
  // custom_id should be the merchant_id
  return customId;
}

async function getMerchantByPayerId(payerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("merchant_id")
    .eq("provider_customer_id", payerId)
    .eq("billing_provider", "paypal")
    .single();

  return data?.merchant_id || null;
}

async function handleSubscriptionActivated(event: PayPalWebhookEvent) {
  const resource = event.resource;
  const merchantId = resource.custom_id || await getMerchantByPayerId(resource.subscriber?.payer_id || "");

  if (!merchantId) {
    console.error("Cannot find merchant for PayPal subscription:", resource.id);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      provider_customer_id: resource.subscriber?.payer_id,
      provider_subscription_id: resource.id,
      current_period_start: resource.start_time 
        ? new Date(resource.start_time).toISOString() 
        : new Date().toISOString(),
      current_period_end: resource.billing_info?.next_billing_time
        ? new Date(resource.billing_info.next_billing_time).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);

  console.log(`PayPal subscription activated for merchant ${merchantId}`);
}

async function handleSubscriptionCancelled(event: PayPalWebhookEvent) {
  const resource = event.resource;
  const merchantId = resource.custom_id || await getMerchantByPayerId(resource.subscriber?.payer_id || "");

  if (!merchantId) {
    console.error("Cannot find merchant for PayPal subscription:", resource.id);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);

  console.log(`PayPal subscription cancelled for merchant ${merchantId}`);
}

async function handleSubscriptionSuspended(event: PayPalWebhookEvent) {
  const resource = event.resource;
  const merchantId = resource.custom_id || await getMerchantByPayerId(resource.subscriber?.payer_id || "");

  if (!merchantId) {
    console.error("Cannot find merchant for PayPal subscription:", resource.id);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "paused",
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);

  console.log(`PayPal subscription suspended for merchant ${merchantId}`);
}

async function handlePaymentFailed(event: PayPalWebhookEvent) {
  const resource = event.resource;
  const merchantId = resource.custom_id || await getMerchantByPayerId(resource.subscriber?.payer_id || "");

  if (!merchantId) {
    console.error("Cannot find merchant for PayPal subscription:", resource.id);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);

  console.log(`PayPal payment failed for merchant ${merchantId}`);
}

async function handlePaymentCompleted(event: PayPalWebhookEvent) {
  const resource = event.resource;
  
  // For sale events, we need to find the associated subscription
  // The custom_id might be in the parent subscription
  const merchantId = resource.custom_id;

  if (!merchantId) {
    console.log("Payment completed but no merchant_id in custom_id, skipping");
    return;
  }

  // Get subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("merchant_id", merchantId)
    .single();

  if (subscription) {
    // Create new SMS usage period
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabase
      .from("sms_usage")
      .insert({
        subscription_id: subscription.id,
        count: 0,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
      });
  }

  // Ensure subscription is active
  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);

  console.log(`PayPal payment completed for merchant ${merchantId}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  
  // Verify webhook signature in production
  if (PAYPAL_MODE === "live") {
    const isValid = await verifyWebhookSignature(req.headers, body);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(body) as PayPalWebhookEvent;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response: WebhookResponse = { received: true, type: event.event_type };

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await handleSubscriptionActivated(event);
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
        await handleSubscriptionCancelled(event);
        break;

      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await handleSubscriptionSuspended(event);
        break;

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        await handlePaymentFailed(event);
        break;

      case "PAYMENT.SALE.COMPLETED":
        await handlePaymentCompleted(event);
        break;

      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }

    // Log successful event processing
    await logBillingEvent(
      event.event_type,
      event.id,
      event as unknown as Record<string, unknown>,
      event.resource.custom_id,
      undefined,
      true
    );
  } catch (error) {
    console.error(`Error handling ${event.event_type}:`, error);
    
    // Log failed event processing
    await logBillingEvent(
      event.event_type,
      event.id,
      event as unknown as Record<string, unknown>,
      event.resource.custom_id,
      undefined,
      false,
      error instanceof Error ? error.message : "Unknown error"
    );

    response.error = error instanceof Error ? error.message : "Unknown error";
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

