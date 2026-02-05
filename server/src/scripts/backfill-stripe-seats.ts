import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ override: true });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const STAFF_SEAT_PRICE_IDS = new Set([
  'price_1SqSvwGXlKB5nE0whqwMF8h9', // Monthly staff seat
  'price_1SqTURGXlKB5nE0wCBcgK7sV', // Annual staff seat
]);

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const isDryRun = process.argv.includes('--dry-run');

const toIsoFromSeconds = (seconds?: number | null) => (
  typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null
);

const parseMetadataSeatCount = (metadata?: Stripe.Metadata | null) => {
  const raw = metadata?.seats_count;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const deriveSeatsCount = (subscription: Stripe.Subscription) => {
  const items = subscription.items?.data ?? [];
  const seatItem = items.find((item) => {
    const priceId = item.price?.id;
    return priceId ? STAFF_SEAT_PRICE_IDS.has(priceId) : false;
  });
  if (seatItem?.quantity && seatItem.quantity > 0) {
    return seatItem.quantity;
  }
  const metadataCount = parseMetadataSeatCount(subscription.metadata);
  if (metadataCount) {
    return metadataCount;
  }
  const quantities = items
    .map((item) => item.quantity ?? 1)
    .filter((qty) => typeof qty === 'number' && qty > 0);
  if (quantities.length === 0) {
    return 1;
  }
  return Math.max(...quantities);
};

const getSubscriptionTimestamp = (subscription: Stripe.Subscription) => {
  const currentPeriodStart = (subscription as Stripe.Subscription & {
    current_period_start?: number | null;
  }).current_period_start;
  return currentPeriodStart ?? subscription.created ?? 0;
};

const getSubscriptionStatusPriority = (status: Stripe.Subscription.Status) => {
  switch (status) {
    case 'active':
    case 'trialing':
      return 4;
    case 'past_due':
    case 'paused':
      return 3;
    case 'incomplete':
    case 'unpaid':
      return 2;
    case 'canceled':
      return 1;
    default:
      return 0;
  }
};

const pickBestSubscription = (subscriptions: Stripe.Subscription[]) => {
  if (subscriptions.length === 0) return null;
  const sorted = [...subscriptions].sort((a, b) => {
    const priorityDiff = getSubscriptionStatusPriority(b.status) - getSubscriptionStatusPriority(a.status);
    if (priorityDiff !== 0) return priorityDiff;
    return getSubscriptionTimestamp(b) - getSubscriptionTimestamp(a);
  });
  return sorted[0] || null;
};

const searchStripeSubscriptions = async (merchantId: string) => {
  try {
    const query = `metadata['merchant_id']:'${merchantId}'`;
    const result = await stripe.subscriptions.search({ query, limit: 50 });
    return result.data ?? [];
  } catch (error) {
    console.warn('Stripe subscription search failed:', error);
    return [];
  }
};

const listSubscriptionsForCustomer = async (customerId: string) => {
  try {
    const result = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 50,
    });
    return result.data ?? [];
  } catch (error) {
    console.warn('Stripe subscription list failed:', error);
    return [];
  }
};

const resolveStripeSubscriptionForMerchant = async (
  merchantId: string,
  fallbackSubscriptionId?: string | null,
  fallbackCustomerId?: string | null,
) => {
  const searchResults = await searchStripeSubscriptions(merchantId);
  const bestFromSearch = pickBestSubscription(searchResults);
  if (bestFromSearch) return bestFromSearch;

  if (fallbackCustomerId) {
    const customerSubs = await listSubscriptionsForCustomer(fallbackCustomerId);
    const bestFromCustomer = pickBestSubscription(customerSubs);
    if (bestFromCustomer) return bestFromCustomer;
  }

  if (fallbackSubscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(fallbackSubscriptionId);
    } catch (error) {
      console.warn('Stripe subscription retrieve failed:', error);
    }
  }

  return null;
};

const syncStripeSeatMetadata = async (subscription: Stripe.Subscription, seatsCount: number) => {
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
    console.warn('Failed to sync Stripe seats_count metadata:', error);
  }
};

const buildSubscriptionUpdatesFromStripe = (subscription: Stripe.Subscription, seatsCount: number) => {
  const cancelAtPeriodEnd = Boolean(
    subscription.cancel_at_period_end || subscription.cancel_at
  );
  const currentPeriodStart = (subscription as Stripe.Subscription & {
    current_period_start?: number | null;
  }).current_period_start ?? null;
  const currentPeriodEnd = (subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  }).current_period_end ?? null;

  const updates: Record<string, unknown> = {
    status: subscription.pause_collection ? 'paused' : subscription.status,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_start: toIsoFromSeconds(currentPeriodStart),
    current_period_end: toIsoFromSeconds(currentPeriodEnd),
    trial_start: toIsoFromSeconds(subscription.trial_start as number | null),
    trial_end: toIsoFromSeconds(subscription.trial_end as number | null),
    canceled_at: toIsoFromSeconds(subscription.canceled_at as number | null),
    paused_at: subscription.pause_collection ? new Date().toISOString() : null,
    pause_resumes_at: subscription.pause_collection?.resumes_at
      ? toIsoFromSeconds(subscription.pause_collection.resumes_at)
      : null,
    provider_customer_id: typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id || null,
    provider_subscription_id: subscription.id,
    billing_provider: 'stripe',
    seats_count: seatsCount,
    updated_at: new Date().toISOString(),
  };

  if (subscription.metadata?.plan_id) {
    updates.plan_id = subscription.metadata.plan_id;
  }

  return updates;
};

const run = async () => {
  const { data: merchants, error } = await supabase
    .from('subscriptions')
    .select('merchant_id, provider_subscription_id, provider_customer_id');

  if (error) {
    console.error('Failed to load merchants:', error);
    process.exit(1);
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let missingCount = 0;

  for (const merchant of merchants || []) {
    const merchantId = merchant.merchant_id;
    const subscription = await resolveStripeSubscriptionForMerchant(
      merchantId,
      merchant.provider_subscription_id,
      merchant.provider_customer_id
    );

    if (!subscription) {
      missingCount += 1;
      console.warn(`No Stripe subscription found for merchant ${merchantId}`);
      continue;
    }

    const seatsCount = deriveSeatsCount(subscription);
    const updates = buildSubscriptionUpdatesFromStripe(subscription, seatsCount);

    if (isDryRun) {
      console.log(`[dry-run] ${merchantId}: seats=${seatsCount}, subscription=${subscription.id}`);
      skippedCount += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('merchant_id', merchantId);

    if (updateError) {
      console.error(`Failed to update merchant ${merchantId}:`, updateError);
      skippedCount += 1;
      continue;
    }

    await syncStripeSeatMetadata(subscription, seatsCount);
    updatedCount += 1;
  }

  console.log(`Backfill complete. Updated=${updatedCount}, DryRun=${skippedCount}, Missing=${missingCount}`);
};

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
