/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for subscription management.
 * Events handled:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

interface WebhookResponse {
  received: boolean;
  type?: string;
  error?: string;
}

async function logBillingEvent(
  eventType: string,
  provider: string,
  providerEventId: string,
  payload: Record<string, unknown>,
  merchantId?: string,
  subscriptionId?: string,
  processed = true,
  error?: string
) {
  await supabase.from("billing_events").insert({
    event_type: eventType,
    provider,
    provider_event_id: providerEventId,
    payload,
    merchant_id: merchantId,
    subscription_id: subscriptionId,
    processed,
    error,
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const merchantId = session.metadata?.merchant_id;
  const planId = session.metadata?.plan_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!merchantId) {
    console.error("No merchant_id in checkout session metadata");
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update subscription in database
  const { error } = await supabase
    .from("subscriptions")
    .upsert({
      merchant_id: merchantId,
      plan_id: planId || "starter",
      billing_provider: "stripe",
      provider_customer_id: customerId,
      provider_subscription_id: subscriptionId,
      status: subscription.status === "trialing" ? "trialing" : "active",
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start 
        ? new Date(subscription.trial_start * 1000).toISOString() 
        : null,
      trial_end: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString() 
        : null,
    }, {
      onConflict: "merchant_id",
    });

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }

  console.log(`Checkout completed for merchant ${merchantId}, plan ${planId}`);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const merchantId = subscription.metadata?.merchant_id;
  const planId = subscription.metadata?.plan_id;
  const customerId = subscription.customer as string;

  if (!merchantId) {
    // Try to find merchant by customer ID
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("merchant_id")
      .eq("provider_customer_id", customerId)
      .single();

    if (!existingSub) {
      console.error("Cannot find merchant for subscription", subscription.id);
      return;
    }
  }

  const targetMerchantId = merchantId || (await getMerchantByCustomerId(customerId));
  if (!targetMerchantId) return;

  await supabase
    .from("subscriptions")
    .upsert({
      merchant_id: targetMerchantId,
      plan_id: planId || "starter",
      billing_provider: "stripe",
      provider_customer_id: customerId,
      provider_subscription_id: subscription.id,
      status: subscription.status === "trialing" ? "trialing" : "active",
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start 
        ? new Date(subscription.trial_start * 1000).toISOString() 
        : null,
      trial_end: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString() 
        : null,
    }, {
      onConflict: "merchant_id",
    });

  console.log(`Subscription created: ${subscription.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const merchantId = await getMerchantByCustomerId(customerId);

  if (!merchantId) {
    console.error("Cannot find merchant for customer", customerId);
    return;
  }

  // Map Stripe status to our status
  let status: string;
  switch (subscription.status) {
    case "trialing":
      status = "trialing";
      break;
    case "active":
      status = "active";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "canceled":
      status = "canceled";
      break;
    case "unpaid":
      status = "past_due";
      break;
    case "paused":
      status = "paused";
      break;
    default:
      status = "incomplete";
  }

  // Check if subscription is paused
  const isPaused = subscription.pause_collection !== null;
  const pauseResumesAt = subscription.pause_collection?.resumes_at
    ? new Date(subscription.pause_collection.resumes_at * 1000).toISOString()
    : null;

  await supabase
    .from("subscriptions")
    .update({
      status: isPaused ? "paused" : status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      paused_at: isPaused ? new Date().toISOString() : null,
      pause_resumes_at: pauseResumesAt,
      plan_id: subscription.metadata?.plan_id || undefined,
      seats_count: subscription.metadata?.seats_count 
        ? parseInt(subscription.metadata.seats_count) 
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("provider_customer_id", customerId);

  console.log(`Subscription updated: ${subscription.id}, status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider_customer_id", customerId);

  console.log(`Subscription deleted: ${subscription.id}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const merchantId = await getMerchantByCustomerId(customerId);

  if (!merchantId) {
    console.error("Cannot find merchant for customer", customerId);
    return;
  }

  // Get subscription to reset SMS usage
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("merchant_id", merchantId)
    .single();

  if (subscription) {
    // Create new SMS usage period
    const periodStart = invoice.period_start 
      ? new Date(invoice.period_start * 1000).toISOString()
      : new Date().toISOString();
    const periodEnd = invoice.period_end 
      ? new Date(invoice.period_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("sms_usage")
      .insert({
        subscription_id: subscription.id,
        count: 0,
        period_start: periodStart,
        period_end: periodEnd,
      });
  }

  // Update subscription status to active (in case it was past_due)
  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);

  console.log(`Invoice paid for merchant ${merchantId}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_customer_id", customerId);

  console.log(`Invoice payment failed for customer ${customerId}`);
}

async function getMerchantByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("merchant_id")
    .eq("provider_customer_id", customerId)
    .single();

  return data?.merchant_id || null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "No signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response: WebhookResponse = { received: true, type: event.type };

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Log successful event processing
    await logBillingEvent(
      event.type,
      "stripe",
      event.id,
      event.data.object as unknown as Record<string, unknown>,
      undefined,
      undefined,
      true
    );
  } catch (error) {
    console.error(`Error handling ${event.type}:`, error);
    
    // Log failed event processing
    await logBillingEvent(
      event.type,
      "stripe",
      event.id,
      event.data.object as unknown as Record<string, unknown>,
      undefined,
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

