import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const router = Router();

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
const supabase = (config.supabase.url && config.supabase.serviceRoleKey)
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey)
  : null;

const requireStripe = (): Stripe => {
  if (!stripe) {
    throw new Error('Stripe is not configured. STRIPE_SECRET_KEY is required.');
  }
  return stripe;
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return supabase;
};

const STAFF_SEAT_PRICE_IDS = new Set([
  'price_1SqSvwGXlKB5nE0whqwMF8h9', // Monthly staff seat
  'price_1SqTURGXlKB5nE0wCBcgK7sV', // Annual staff seat
]);

const toIso = (timestamp: number | null | undefined) => (
  typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : null
);

const mapStripeStatus = (subscription: Stripe.Subscription) => {
  if (subscription.pause_collection) {
    return 'paused';
  }

  switch (subscription.status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
      return subscription.status;
    case 'unpaid':
      return 'past_due';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'canceled';
    default:
      return subscription.status;
  }
};

const parseMetadataSeatCount = (metadata?: Stripe.Metadata | null) => {
  const raw = metadata?.seats_count;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const findSeatSubscriptionItem = (subscription: Stripe.Subscription) => {
  const items = subscription.items?.data ?? [];
  return items.find((item) => {
    const priceId = item.price?.id;
    return priceId ? STAFF_SEAT_PRICE_IDS.has(priceId) : false;
  }) || null;
};

const deriveSeatCount = (subscription: Stripe.Subscription) => {
  const seatItem = findSeatSubscriptionItem(subscription);
  if (seatItem?.quantity && seatItem.quantity > 0) {
    return seatItem.quantity;
  }
  const metadataCount = parseMetadataSeatCount(subscription.metadata);
  if (metadataCount) {
    return metadataCount;
  }
  return 1;
};

const getScheduleIdFromSubscription = (subscription: Stripe.Subscription) => {
  const scheduleRef = subscription.schedule;
  if (!scheduleRef) return null;
  if (typeof scheduleRef === 'string') return scheduleRef;
  if (typeof scheduleRef === 'object' && 'id' in scheduleRef && typeof scheduleRef.id === 'string') {
    return scheduleRef.id;
  }
  return null;
};

const extractSeatQuantityFromSchedulePhase = (
  phase?: {
    items?: Array<{
      price?: string | { id?: string | null } | null;
      quantity?: number | null;
    }>;
  } | null
) => {
  if (!phase) return null;
  const item = (phase.items || []).find((candidate) => {
    const priceId = typeof candidate.price === 'string'
      ? candidate.price
      : candidate.price?.id;
    return priceId ? STAFF_SEAT_PRICE_IDS.has(priceId) : false;
  });
  if (!item) return null;
  const quantity = item.quantity ?? null;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return null;
  return Math.floor(quantity);
};

const resolvePendingSeatChangeState = async (
  subscription: Stripe.Subscription,
  currentSeatsOverride?: number,
) => {
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
    schedule = await requireStripe().subscriptionSchedules.retrieve(scheduleId);
  } catch (error) {
    const code = typeof error === 'object' && error
      ? (error as { code?: string }).code
      : undefined;
    if (code === 'resource_missing') {
      return {
        pendingSeatCount: null,
        pendingSeatEffectiveAt: null,
        pendingSeatScheduleId: null,
      };
    }
    throw error;
  }

  if (schedule.status === 'released' || schedule.status === 'canceled' || schedule.status === 'completed') {
    return {
      pendingSeatCount: null,
      pendingSeatEffectiveAt: null,
      pendingSeatScheduleId: null,
    };
  }

  const currentSeats = typeof currentSeatsOverride === 'number'
    ? currentSeatsOverride
    : deriveSeatCount(subscription);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const phases = [...(schedule.phases || [])]
    .filter((phase) => typeof phase.start_date === 'number' && Number.isFinite(phase.start_date))
    .sort((a, b) => (a.start_date as number) - (b.start_date as number));
  const currentPhaseEnd = schedule.current_phase?.end_date;
  const targetPhase = (
    (typeof currentPhaseEnd === 'number' && Number.isFinite(currentPhaseEnd))
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
    pendingSeatEffectiveAt: toIso(targetPhase.start_date as number),
    pendingSeatScheduleId: schedule.id,
  };
};

const syncStripeSeatMetadata = async (subscription: Stripe.Subscription, seatsCount: number) => {
  const current = parseMetadataSeatCount(subscription.metadata);
  if (current === seatsCount) return;
  try {
    await requireStripe().subscriptions.update(subscription.id, {
      metadata: {
        ...(subscription.metadata || {}),
        seats_count: seatsCount.toString(),
      },
    });
  } catch (error) {
    console.warn('Failed to sync Stripe seats_count metadata:', error);
  }
};

const enforceSeatCoverage = async (
  subscription: Stripe.Subscription,
  merchantId: string,
  event: Stripe.Event,
  subscriptionRowId?: string | null
) => {
  const seatItem = findSeatSubscriptionItem(subscription);
  if (!seatItem) return subscription;

  const stripeSeats = deriveSeatCount(subscription);
  const { count: activeStaffCount } = await requireSupabase()
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('active', true);
  const activeStaff = activeStaffCount ?? 0;

  if (stripeSeats >= activeStaff) {
    return subscription;
  }

  try {
    const corrected = await requireStripe().subscriptions.update(subscription.id, {
      items: [{ id: seatItem.id, quantity: activeStaff }],
      proration_behavior: 'none',
      metadata: {
        ...(subscription.metadata || {}),
        seats_count: activeStaff.toString(),
      },
    });

    await requireSupabase()
      .from('billing_events')
      .insert({
        event_type: 'stripe.seat_auto_revert.applied',
        provider: 'stripe',
        provider_event_id: event.id,
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
    await requireSupabase()
      .from('billing_events')
      .insert({
        event_type: 'stripe.seat_auto_revert.failed',
        provider: 'stripe',
        provider_event_id: event.id,
        merchant_id: merchantId,
        subscription_id: subscriptionRowId ?? null,
        payload: {
          stripe_subscription_id: subscription.id,
          stripe_seats_before: stripeSeats,
          active_staff: activeStaff,
        },
        processed: false,
        error: error instanceof Error ? error.message : 'seat auto-revert failed',
      });
    throw error;
  }
};

const resolveMerchantId = async (subscription: Stripe.Subscription) => {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;
  let merchantId = subscription.metadata?.merchant_id || null;
  let subscriptionId: string | null = null;

  if (!merchantId) {
    const { data } = await requireSupabase()
      .from('subscriptions')
      .select('id, merchant_id')
      .eq('provider_subscription_id', subscription.id)
      .single();

    if (data) {
      merchantId = data.merchant_id;
      subscriptionId = data.id;
    }
  }

  if (!merchantId && customerId) {
    const { data } = await requireSupabase()
      .from('subscriptions')
      .select('id, merchant_id')
      .eq('provider_customer_id', customerId)
      .single();

    if (data) {
      merchantId = data.merchant_id;
      subscriptionId = data.id;
    }
  }

  return { merchantId, subscriptionId, customerId };
};

const upsertSubscriptionFromStripe = async (subscription: Stripe.Subscription, event: Stripe.Event) => {
  const { merchantId, subscriptionId: existingSubscriptionId, customerId } = await resolveMerchantId(subscription);
  if (!merchantId) {
    console.warn('Stripe webhook missing merchant id for subscription', subscription.id);
    return;
  }

  const enforcedSubscription = event.type === 'customer.subscription.deleted'
    ? subscription
    : await enforceSeatCoverage(
      subscription,
      merchantId,
      event,
      existingSubscriptionId
    );

  const currentPeriodStart = (enforcedSubscription as Stripe.Subscription & { current_period_start?: number })
    .current_period_start;
  const currentPeriodEnd = (enforcedSubscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  const status = mapStripeStatus(enforcedSubscription);
  const cancelAtPeriodEnd = Boolean(enforcedSubscription.cancel_at_period_end || enforcedSubscription.cancel_at);
  const updates: Record<string, unknown> = {
    merchant_id: merchantId,
    billing_provider: 'stripe',
    provider_customer_id: customerId ?? null,
    provider_subscription_id: enforcedSubscription.id,
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_start: toIso(currentPeriodStart ?? null),
    current_period_end: toIso(currentPeriodEnd ?? null),
    trial_start: toIso(enforcedSubscription.trial_start as number | null),
    trial_end: toIso(enforcedSubscription.trial_end as number | null),
    canceled_at: toIso(enforcedSubscription.canceled_at as number | null),
    updated_at: new Date().toISOString(),
  };

  if (enforcedSubscription.metadata?.plan_id) {
    updates.plan_id = enforcedSubscription.metadata.plan_id;
  }

  const seatsCount = deriveSeatCount(enforcedSubscription);
  updates.seats_count = seatsCount;
  const pendingSeatChange = event.type === 'customer.subscription.deleted'
    ? {
      pendingSeatCount: null,
      pendingSeatEffectiveAt: null,
      pendingSeatScheduleId: null,
    }
    : await resolvePendingSeatChangeState(enforcedSubscription, seatsCount);
  updates.pending_seat_count = pendingSeatChange.pendingSeatCount;
  updates.pending_seat_effective_at = pendingSeatChange.pendingSeatEffectiveAt;
  updates.pending_seat_schedule_id = pendingSeatChange.pendingSeatScheduleId;

  if (enforcedSubscription.pause_collection) {
    updates.paused_at = new Date().toISOString();
    updates.pause_resumes_at = enforcedSubscription.pause_collection.resumes_at
      ? toIso(enforcedSubscription.pause_collection.resumes_at)
      : null;
  } else {
    updates.paused_at = null;
    updates.pause_resumes_at = null;
  }

  const { data: upserted, error } = await requireSupabase()
    .from('subscriptions')
    .upsert(updates, { onConflict: 'merchant_id' })
    .select('id')
    .single();

  if (error) {
    console.error('Stripe webhook failed to upsert subscription', error);
    return;
  }

  await syncStripeSeatMetadata(enforcedSubscription, seatsCount);
  await requireSupabase()
    .from('billing_events')
    .insert({
      event_type: event.type,
      provider: 'stripe',
      provider_event_id: event.id,
      merchant_id: merchantId,
      subscription_id: upserted?.id || existingSubscriptionId || null,
      payload: event,
      processed: true,
    });
};

router.post('/', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  if (!config.stripe.webhookSecret) {
    console.error('Stripe webhook secret is not configured.');
    return res.status(500).send('Stripe webhook secret not configured.');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).send('Missing Stripe signature.');
  }

  let event: Stripe.Event;

  try {
    event = requireStripe().webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed.', error);
    return res.status(400).send('Webhook signature verification failed.');
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(subscription, event);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Stripe webhook processing failed.', error);
    return res.status(500).send('Webhook processing failed.');
  }

  return res.json({ received: true });
});

export default router;
