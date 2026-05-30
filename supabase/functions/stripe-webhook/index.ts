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
const STAFF_SEAT_PRICE_IDS = new Set([
  "price_1SqSvwGXlKB5nE0whqwMF8h9", // Monthly staff seat
  "price_1SqTURGXlKB5nE0wCBcgK7sV", // Annual staff seat
]);

interface WebhookResponse {
  received: boolean;
  type?: string;
  error?: string;
}

function toIsoFromSeconds(seconds?: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function parseMetadataSeatCount(metadata?: Stripe.Metadata | null): number | null {
  const raw = metadata?.seats_count;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function findSeatSubscriptionItem(subscription: Stripe.Subscription) {
  const items = subscription.items?.data ?? [];
  return items.find((item) => {
    const priceId = item.price?.id;
    return priceId ? STAFF_SEAT_PRICE_IDS.has(priceId) : false;
  }) || null;
}

function deriveSeatsCount(subscription: Stripe.Subscription): number {
  const seatItem = findSeatSubscriptionItem(subscription);
  if (seatItem?.quantity && seatItem.quantity > 0) {
    return seatItem.quantity;
  }
  const metadataCount = parseMetadataSeatCount(subscription.metadata);
  if (metadataCount) {
    return metadataCount;
  }
  return 1;
}

function getScheduleIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const scheduleRef = subscription.schedule;
  if (!scheduleRef) return null;
  if (typeof scheduleRef === "string") return scheduleRef;
  if (typeof scheduleRef === "object" && "id" in scheduleRef && typeof scheduleRef.id === "string") {
    return scheduleRef.id;
  }
  return null;
}

function extractSeatQuantityFromSchedulePhase(
  phase?: {
    items?: Array<{
      price?: string | { id?: string | null } | null;
      quantity?: number | null;
    }>;
  } | null
): number | null {
  if (!phase) return null;
  const item = (phase.items || []).find((candidate) => {
    const priceId = typeof candidate.price === "string"
      ? candidate.price
      : candidate.price?.id;
    return priceId ? STAFF_SEAT_PRICE_IDS.has(priceId) : false;
  });
  if (!item) return null;
  const quantity = item.quantity ?? null;
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return null;
  return Math.floor(quantity);
}

async function resolvePendingSeatChangeState(
  subscription: Stripe.Subscription,
  currentSeatsOverride?: number
): Promise<{
  pendingSeatCount: number | null;
  pendingSeatEffectiveAt: string | null;
  pendingSeatScheduleId: string | null;
}> {
  const scheduleId = getScheduleIdFromSubscription(subscription);
  if (!scheduleId) {
    return {
      pendingSeatCount: null,
      pendingSeatEffectiveAt: null,
      pendingSeatScheduleId: null,
    };
  }

  let schedule: Stripe.SubscriptionSchedule;
  try {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } catch (error) {
    const code = typeof error === "object" && error
      ? (error as { code?: string }).code
      : undefined;
    if (code === "resource_missing") {
      return {
        pendingSeatCount: null,
        pendingSeatEffectiveAt: null,
        pendingSeatScheduleId: null,
      };
    }
    throw error;
  }

  if (schedule.status === "released" || schedule.status === "canceled" || schedule.status === "completed") {
    return {
      pendingSeatCount: null,
      pendingSeatEffectiveAt: null,
      pendingSeatScheduleId: null,
    };
  }

  const currentSeats = typeof currentSeatsOverride === "number"
    ? currentSeatsOverride
    : deriveSeatsCount(subscription);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const phases = [...(schedule.phases || [])]
    .filter((phase) => typeof phase.start_date === "number" && Number.isFinite(phase.start_date))
    .sort((a, b) => (a.start_date as number) - (b.start_date as number));
  const currentPhaseEnd = schedule.current_phase?.end_date;
  const targetPhase = (
    (typeof currentPhaseEnd === "number" && Number.isFinite(currentPhaseEnd))
      ? phases.find((phase) => (phase.start_date as number) >= currentPhaseEnd)
      : undefined
  ) || phases.find((phase) => (phase.start_date as number) > nowSeconds) || null;
  const pendingSeatCount = extractSeatQuantityFromSchedulePhase(targetPhase);

  if (!targetPhase || pendingSeatCount === null || pendingSeatCount >= currentSeats) {
    return {
      pendingSeatCount: null,
      pendingSeatEffectiveAt: null,
      pendingSeatScheduleId: null,
    };
  }

  return {
    pendingSeatCount,
    pendingSeatEffectiveAt: toIsoFromSeconds(targetPhase.start_date as number),
    pendingSeatScheduleId: schedule.id,
  };
}

async function syncStripeSeatMetadata(subscription: Stripe.Subscription, seatsCount: number) {
  const current = parseMetadataSeatCount(subscription.metadata);
  if (current === seatsCount) return;
  try {
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...(subscription.metadata || {}),
        seats_count: seatsCount.toString(),
      },
    });
  } catch (error) {
    console.warn("Failed to sync Stripe seats_count metadata:", error);
  }
}

async function enforceSeatCoverage(
  subscription: Stripe.Subscription,
  merchantId: string,
  providerEventId: string,
  subscriptionRowId?: string | null
): Promise<Stripe.Subscription> {
  const seatItem = findSeatSubscriptionItem(subscription);
  if (!seatItem) return subscription;

  const stripeSeats = deriveSeatsCount(subscription);
  const { count: activeStaffCount } = await supabase
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("active", true);
  const activeStaff = activeStaffCount ?? 0;

  if (stripeSeats >= activeStaff) return subscription;

  try {
    const corrected = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: seatItem.id, quantity: activeStaff }],
      proration_behavior: "none",
      metadata: {
        ...(subscription.metadata || {}),
        seats_count: activeStaff.toString(),
      },
    });

    await supabase.from("billing_events").insert({
      event_type: "stripe.seat_auto_revert.applied",
      provider: "stripe",
      provider_event_id: providerEventId,
      merchant_id: merchantId,
      subscription_id: subscriptionRowId ?? null,
      payload: {
        stripe_subscription_id: subscription.id,
        stripe_seats_before: stripeSeats,
        stripe_seats_after: activeStaff,
        active_staff: activeStaff,
      },
      processed: true,
    });

    return corrected;
  } catch (error) {
    await supabase.from("billing_events").insert({
      event_type: "stripe.seat_auto_revert.failed",
      provider: "stripe",
      provider_event_id: providerEventId,
      merchant_id: merchantId,
      subscription_id: subscriptionRowId ?? null,
      payload: {
        stripe_subscription_id: subscription.id,
        stripe_seats_before: stripeSeats,
        active_staff: activeStaff,
      },
      processed: false,
      error: error instanceof Error ? error.message : "seat auto-revert failed",
    });
    throw error;
  }
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

async function resolveMerchantContext({
  metadataMerchantId,
  subscriptionId,
  customerId,
}: {
  metadataMerchantId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
}) {
  let merchantId = metadataMerchantId ?? null;
  let resolvedSubscriptionId: string | null = null;

  if (!merchantId && subscriptionId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, merchant_id")
      .eq("provider_subscription_id", subscriptionId)
      .single();

    if (data) {
      merchantId = data.merchant_id;
      resolvedSubscriptionId = data.id;
    }
  }

  if (!merchantId && customerId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, merchant_id")
      .eq("provider_customer_id", customerId)
      .single();

    if (data) {
      merchantId = data.merchant_id;
      resolvedSubscriptionId = data.id;
    }
  }

  return {
    merchantId,
    subscriptionId: resolvedSubscriptionId,
    customerId: customerId ?? null,
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const merchantId = session.metadata?.merchant_id;
  const planId = session.metadata?.plan_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  const resolved = await resolveMerchantContext({
    metadataMerchantId: merchantId,
    subscriptionId,
    customerId,
  });

  if (!resolved.merchantId) {
    console.error("No merchant_id in checkout session metadata");
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const seatsCount = deriveSeatsCount(subscription);
  const pendingSeatChange = await resolvePendingSeatChangeState(subscription, seatsCount);

  // Update subscription in database
  const { error } = await supabase
    .from("subscriptions")
    .upsert({
      merchant_id: resolved.merchantId,
      plan_id: planId || "starter",
      billing_provider: "stripe",
      provider_customer_id: resolved.customerId,
      provider_subscription_id: subscriptionId,
      status: subscription.status === "trialing" ? "trialing" : "active",
      current_period_start: toIsoFromSeconds(subscription.current_period_start),
      current_period_end: toIsoFromSeconds(subscription.current_period_end),
      trial_start: toIsoFromSeconds(subscription.trial_start ?? null),
      trial_end: toIsoFromSeconds(subscription.trial_end ?? null),
      seats_count: seatsCount,
      pending_seat_count: pendingSeatChange.pendingSeatCount,
      pending_seat_effective_at: pendingSeatChange.pendingSeatEffectiveAt,
      pending_seat_schedule_id: pendingSeatChange.pendingSeatScheduleId,
    }, {
      onConflict: "merchant_id",
    });

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }

  await syncStripeSeatMetadata(subscription, seatsCount);
  console.log(`Checkout completed for merchant ${merchantId}, plan ${planId}`);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const planId = subscription.metadata?.plan_id;
  const customerId = subscription.customer as string;
  const item = subscription.items?.data?.[0];
  const currentPeriodStart = toIsoFromSeconds(
    subscription.current_period_start ?? item?.current_period_start ?? null
  );
  const currentPeriodEnd = toIsoFromSeconds(
    subscription.current_period_end ?? item?.current_period_end ?? null
  );

  const resolved = await resolveMerchantContext({
    metadataMerchantId: subscription.metadata?.merchant_id,
    subscriptionId: subscription.id,
    customerId,
  });

  if (!resolved.merchantId) {
    console.error("Cannot find merchant for subscription", subscription.id);
    return;
  }

  const seatsCount = deriveSeatsCount(subscription);
  const pendingSeatChange = await resolvePendingSeatChangeState(subscription, seatsCount);

  await supabase
    .from("subscriptions")
    .upsert({
      merchant_id: resolved.merchantId,
      plan_id: planId || "starter",
      billing_provider: "stripe",
      provider_customer_id: resolved.customerId,
      provider_subscription_id: subscription.id,
      status: subscription.status === "trialing" ? "trialing" : "active",
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      trial_start: toIsoFromSeconds(subscription.trial_start ?? null),
      trial_end: toIsoFromSeconds(subscription.trial_end ?? null),
      seats_count: seatsCount,
      pending_seat_count: pendingSeatChange.pendingSeatCount,
      pending_seat_effective_at: pendingSeatChange.pendingSeatEffectiveAt,
      pending_seat_schedule_id: pendingSeatChange.pendingSeatScheduleId,
    }, {
      onConflict: "merchant_id",
    });

  await syncStripeSeatMetadata(subscription, seatsCount);
  console.log(`Subscription created: ${subscription.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, providerEventId: string) {
  const customerId = subscription.customer as string;
  const resolved = await resolveMerchantContext({
    metadataMerchantId: subscription.metadata?.merchant_id,
    subscriptionId: subscription.id,
    customerId,
  });
  if (!resolved.merchantId) {
    console.error("Cannot find merchant for customer", customerId);
    return;
  }

  const enforcedSubscription = await enforceSeatCoverage(
    subscription,
    resolved.merchantId,
    providerEventId,
    resolved.subscriptionId
  );
  const item = enforcedSubscription.items?.data?.[0];
  const currentPeriodStart = toIsoFromSeconds(
    enforcedSubscription.current_period_start ?? item?.current_period_start ?? null
  );
  const currentPeriodEnd = toIsoFromSeconds(
    enforcedSubscription.current_period_end ?? item?.current_period_end ?? null
  );

  // Map Stripe status to our status
  let status: string;
  switch (enforcedSubscription.status) {
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

  const seatsCount = deriveSeatsCount(enforcedSubscription);
  const pendingSeatChange = await resolvePendingSeatChangeState(enforcedSubscription, seatsCount);

  // Check if subscription is paused
  const isPaused = enforcedSubscription.pause_collection !== null;
  const pauseResumesAt = toIsoFromSeconds(enforcedSubscription.pause_collection?.resumes_at ?? null);
  const cancelAtPeriodEnd = Boolean(enforcedSubscription.cancel_at_period_end || enforcedSubscription.cancel_at);

  const updates: Record<string, unknown> = {
    merchant_id: resolved.merchantId,
    billing_provider: "stripe",
    provider_customer_id: resolved.customerId,
    provider_subscription_id: enforcedSubscription.id,
    status: isPaused ? "paused" : status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    canceled_at: toIsoFromSeconds(enforcedSubscription.canceled_at ?? null),
    paused_at: isPaused ? new Date().toISOString() : null,
    pause_resumes_at: pauseResumesAt,
    updated_at: new Date().toISOString(),
  };

  if (enforcedSubscription.metadata?.plan_id) {
    updates.plan_id = enforcedSubscription.metadata.plan_id;
  }
  updates.seats_count = seatsCount;
  updates.pending_seat_count = pendingSeatChange.pendingSeatCount;
  updates.pending_seat_effective_at = pendingSeatChange.pendingSeatEffectiveAt;
  updates.pending_seat_schedule_id = pendingSeatChange.pendingSeatScheduleId;

  await supabase
    .from("subscriptions")
    .upsert(updates, { onConflict: "merchant_id" });

  await syncStripeSeatMetadata(enforcedSubscription, seatsCount);
  console.log(`Subscription updated: ${enforcedSubscription.id}, status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const resolved = await resolveMerchantContext({
    metadataMerchantId: subscription.metadata?.merchant_id,
    subscriptionId: subscription.id,
    customerId,
  });

  if (!resolved.merchantId) {
    console.error("Cannot find merchant for deleted subscription", subscription.id);
    return;
  }

  await supabase
    .from("subscriptions")
    .upsert({
      merchant_id: resolved.merchantId,
      billing_provider: "stripe",
      provider_customer_id: resolved.customerId,
      provider_subscription_id: subscription.id,
      status: "canceled",
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
      canceled_at: new Date().toISOString(),
      pending_seat_count: null,
      pending_seat_effective_at: null,
      pending_seat_schedule_id: null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "merchant_id",
    });

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
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id);
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
