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

  const status = mapStripeStatus(subscription);
  const updates: Record<string, unknown> = {
    merchant_id: merchantId,
    billing_provider: 'stripe',
    provider_customer_id: customerId ?? null,
    provider_subscription_id: subscription.id,
    status,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    current_period_start: toIso(subscription.current_period_start as number | null),
    current_period_end: toIso(subscription.current_period_end as number | null),
    trial_start: toIso(subscription.trial_start as number | null),
    trial_end: toIso(subscription.trial_end as number | null),
    canceled_at: toIso(subscription.canceled_at as number | null),
    updated_at: new Date().toISOString(),
  };

  if (subscription.metadata?.plan_id) {
    updates.plan_id = subscription.metadata.plan_id;
  }

  if (subscription.metadata?.seats_count) {
    const parsedSeats = parseInt(subscription.metadata.seats_count, 10);
    if (!Number.isNaN(parsedSeats)) {
      updates.seats_count = parsedSeats;
    }
  }

  if (subscription.pause_collection) {
    updates.paused_at = new Date().toISOString();
    updates.pause_resumes_at = subscription.pause_collection.resumes_at
      ? toIso(subscription.pause_collection.resumes_at)
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
