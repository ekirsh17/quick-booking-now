import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';

import { executeSeatUpdate } from './billing.js';

const STAFF_PRICE_MONTHLY = 'price_1SqSvwGXlKB5nE0whqwMF8h9';

const makeStripeSubscription = (
  overrides: Record<string, unknown> = {},
  quantity = 1,
): Stripe.Subscription => {
  const base = {
    id: 'sub_base',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    created: Math.floor(Date.now() / 1000),
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    trial_start: null,
    trial_end: null,
    canceled_at: null,
    pause_collection: null,
    customer: 'cus_123',
    metadata: {
      merchant_id: 'merchant-123',
      plan_id: 'starter',
      seats_count: String(quantity),
    },
    latest_invoice: null,
    items: {
      data: [
        {
          id: 'si_seat',
          quantity,
          price: { id: STAFF_PRICE_MONTHLY },
        },
      ],
    },
  };

  return {
    ...base,
    ...overrides,
  } as unknown as Stripe.Subscription;
};

const makeDeps = () => {
  const persisted: Array<{ merchantId: string; updates: Record<string, unknown> }> = [];
  const logged: Array<Record<string, unknown>> = [];
  const synced: Array<{ subscriptionId: string; seatsCount: number }> = [];

  let resolvedSubscription: Stripe.Subscription | null = makeStripeSubscription();
  let updateResult: Stripe.Subscription = makeStripeSubscription();
  let updateError: unknown = null;

  const stripeClient = {
    subscriptions: {
      update: async (subscriptionId: string) => {
        if (updateError) throw updateError;
        return {
          ...updateResult,
          id: updateResult.id || subscriptionId,
        };
      },
      retrieve: async () => updateResult,
    },
  } as unknown as Stripe;

  return {
    persisted,
    logged,
    synced,
    setResolvedSubscription: (value: Stripe.Subscription | null) => {
      resolvedSubscription = value;
    },
    setUpdateResult: (value: Stripe.Subscription) => {
      updateResult = value;
      updateError = null;
    },
    setUpdateError: (value: unknown) => {
      updateError = value;
    },
    deps: {
      stripeClient,
      resolveSubscription: async () => resolvedSubscription,
      persistSubscription: async (merchantId: string, updates: Record<string, unknown>) => {
        persisted.push({ merchantId, updates });
      },
      syncSeatMetadata: async (subscription: Stripe.Subscription, seatsCount: number) => {
        synced.push({ subscriptionId: subscription.id, seatsCount });
      },
      logEvent: async (event: any) => {
        logged.push(event);
      },
    },
  };
};

const makeRecord = (overrides: Partial<{
  id: string;
  merchant_id: string;
  status: string | null;
  seats_count: number | null;
  billing_provider: string | null;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
}> = {}) => ({
  id: 'sub-row-1',
  merchant_id: 'merchant-123',
  status: 'active',
  seats_count: 1,
  billing_provider: 'stripe',
  provider_subscription_id: 'sub_stale',
  provider_customer_id: 'cus_123',
  ...overrides,
});

test('applies seat increase during trial and persists seats_count', async () => {
  const harness = makeDeps();
  harness.setResolvedSubscription(makeStripeSubscription({ id: 'sub_trial', status: 'trialing' }, 1));
  harness.setUpdateResult(makeStripeSubscription({ id: 'sub_trial', status: 'trialing' }, 3));

  const result = await executeSeatUpdate(
    {
      merchantId: 'merchant-123',
      seatCount: 3,
      activeStaffCount: 1,
      subscriptionRecord: makeRecord({ status: 'trialing' }),
    },
    harness.deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'applied');
  assert.equal(result.body.seatCountEffective, 3);
  assert.equal(harness.persisted.length, 1);
  assert.equal(harness.persisted[0]?.updates.seats_count, 3);
  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0]?.seatsCount, 3);
});

test('applies seat increase for active subscription when payment succeeds', async () => {
  const harness = makeDeps();
  harness.setResolvedSubscription(makeStripeSubscription({ id: 'sub_active', status: 'active' }, 2));
  harness.setUpdateResult(makeStripeSubscription({ id: 'sub_active', status: 'active' }, 4));

  const result = await executeSeatUpdate(
    {
      merchantId: 'merchant-123',
      seatCount: 4,
      activeStaffCount: 2,
      subscriptionRecord: makeRecord({ status: 'active', seats_count: 2 }),
    },
    harness.deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'applied');
  assert.equal(result.body.seatCountEffective, 4);
});

test('returns pending_payment when Stripe requires payment confirmation', async () => {
  const harness = makeDeps();
  harness.setResolvedSubscription(makeStripeSubscription({ id: 'sub_active', status: 'active' }, 2));
  harness.setUpdateError({
    message: 'Your card requires authentication.',
    raw: {
      invoice: {
        hosted_invoice_url: 'https://stripe.test/invoice/in_123',
      },
    },
  });

  const result = await executeSeatUpdate(
    {
      merchantId: 'merchant-123',
      seatCount: 4,
      activeStaffCount: 2,
      subscriptionRecord: makeRecord({ status: 'active', seats_count: 2 }),
    },
    harness.deps,
  );

  assert.equal(result.statusCode, 402);
  assert.equal(result.body.status, 'pending_payment');
  assert.equal(result.body.seatCountEffective, 2);
  assert.equal(result.body.seatCountPending, 4);
  assert.equal(result.body.nextActionUrl, 'https://stripe.test/invoice/in_123');
  assert.equal(harness.synced.length, 0);
});

test('uses resolved canonical Stripe subscription when stored id is stale', async () => {
  const harness = makeDeps();
  harness.setResolvedSubscription(makeStripeSubscription({ id: 'sub_canonical', status: 'active' }, 1));

  let updateSubscriptionId: string | null = null;
  harness.deps.stripeClient = {
    subscriptions: {
      update: async (subscriptionId: string) => {
        updateSubscriptionId = subscriptionId;
        return makeStripeSubscription({ id: subscriptionId, status: 'active' }, 3);
      },
      retrieve: async () => makeStripeSubscription({ id: 'sub_canonical', status: 'active' }, 3),
    },
  } as unknown as Stripe;

  const result = await executeSeatUpdate(
    {
      merchantId: 'merchant-123',
      seatCount: 3,
      activeStaffCount: 1,
      subscriptionRecord: makeRecord({ provider_subscription_id: 'sub_stale' }),
    },
    harness.deps,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'applied');
  assert.equal(updateSubscriptionId, 'sub_canonical');
  assert.equal(harness.persisted[0]?.updates.provider_subscription_id, 'sub_canonical');
});

test('returns SEATS_BELOW_STAFF when requested seats are less than active staff', async () => {
  const harness = makeDeps();

  const result = await executeSeatUpdate(
    {
      merchantId: 'merchant-123',
      seatCount: 2,
      activeStaffCount: 3,
      subscriptionRecord: makeRecord({ seats_count: 3 }),
    },
    harness.deps,
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'SEATS_BELOW_STAFF');
});

test('returns STRIPE_SEAT_ITEM_NOT_FOUND when no seat line item exists', async () => {
  const harness = makeDeps();
  harness.setResolvedSubscription(
    makeStripeSubscription(
      {
        id: 'sub_missing_seat',
        items: {
          data: [
            {
              id: 'si_other',
              quantity: 1,
              price: { id: 'price_other' },
            },
          ],
        },
      },
      1,
    ),
  );

  const result = await executeSeatUpdate(
    {
      merchantId: 'merchant-123',
      seatCount: 2,
      activeStaffCount: 1,
      subscriptionRecord: makeRecord({ seats_count: 1 }),
    },
    harness.deps,
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'STRIPE_SEAT_ITEM_NOT_FOUND');
});
