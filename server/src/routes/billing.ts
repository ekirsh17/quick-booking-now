import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();

// Initialize Stripe only if key is provided
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Initialize Supabase with service role for server-side operations
// Only initialize if both URL and key are provided
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Helper to check if Supabase is configured
const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return supabase;
};

// Helper to check if Stripe is configured
const requireStripe = (): Stripe => {
  if (!stripe) {
    throw new Error('Stripe is not configured. STRIPE_SECRET_KEY is required.');
  }
  return stripe;
};

const STAFF_SEAT_PRICE_IDS = new Set([
  'price_1SqSvwGXlKB5nE0whqwMF8h9', // Monthly staff seat
  'price_1SqTURGXlKB5nE0wCBcgK7sV', // Annual staff seat
]);
const PORTAL_CONFIG_ID = process.env.STRIPE_BILLING_PORTAL_CONFIG_ID || '';

// ============================================
// Types & Schemas
// ============================================

const CreateCheckoutSchema = z.object({
  merchantId: z.string().uuid(),
  planId: z.enum(['starter', 'pro']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  email: z.string().email().optional(),
  seatsCount: z.number().int().min(1).max(100).optional(),
  billingCadence: z.enum(['monthly', 'annual']).optional(),
});

const CreatePortalSchema = z.object({
  merchantId: z.string().uuid(),
  returnUrl: z.string().url(),
});

const UpdateSeatsSchema = z.object({
  merchantId: z.string().uuid(),
  seatCount: z.number().int().min(1).max(100),
});

const ReportSmsUsageSchema = z.object({
  merchantId: z.string().uuid(),
  count: z.number().int().min(1),
});

const CancelSubscriptionSchema = z.object({
  merchantId: z.string().uuid(),
  immediately: z.boolean().optional().default(false),
});

const PauseSubscriptionSchema = z.object({
  merchantId: z.string().uuid(),
  pauseMonths: z.number().int().min(1).max(3),
});

const ReconcileSubscriptionSchema = z.object({
  merchantId: z.string().uuid(),
});

type SeatUpdateStatus = 'applied' | 'pending_payment' | 'noop';

interface SeatUpdateApiResponse {
  status?: SeatUpdateStatus;
  seatCountRequested?: number;
  seatCountEffective?: number;
  seatCountPending?: number;
  invoiceId?: string;
  nextActionUrl?: string;
  message?: string;
  error?: string;
  code?: string;
}

interface SeatUpdateSubscriptionRecord {
  id: string;
  merchant_id: string;
  status: string | null;
  seats_count: number | null;
  billing_provider: string | null;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
}

interface SeatUpdateExecutionInput {
  merchantId: string;
  seatCount: number;
  activeStaffCount: number;
  subscriptionRecord: SeatUpdateSubscriptionRecord;
}

interface SeatUpdateEventPayload {
  eventType: string;
  merchantId: string;
  subscriptionId?: string | null;
  providerEventId?: string | null;
  payload: Record<string, unknown>;
  processed?: boolean;
  error?: string | null;
}

interface SeatUpdateExecutionDependencies {
  stripeClient: Stripe;
  resolveSubscription: (
    merchantId: string,
    fallbackSubscriptionId?: string | null,
    fallbackCustomerId?: string | null,
  ) => Promise<Stripe.Subscription | null>;
  persistSubscription: (merchantId: string, updates: Record<string, unknown>) => Promise<void>;
  syncSeatMetadata: (subscription: Stripe.Subscription, seatsCount: number) => Promise<void>;
  logEvent: (event: SeatUpdateEventPayload) => Promise<void>;
}

interface BillingPaymentMethodSummary {
  type: 'card';
  brand: string | null;
  last4: string | null;
}

// ============================================
// Helper Functions
// ============================================

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

const findSeatSubscriptionItem = (subscription: Stripe.Subscription) => {
  const items = subscription.items?.data ?? [];
  return items.find((item) => {
    const priceId = item.price?.id;
    return priceId ? STAFF_SEAT_PRICE_IDS.has(priceId) : false;
  }) || null;
};

const deriveSeatsCount = (subscription: Stripe.Subscription) => {
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

const syncStripeSeatMetadataWithClient = async (
  stripeClient: Stripe,
  subscription: Stripe.Subscription,
  seatsCount: number
) => {
  const current = parseMetadataSeatCount(subscription.metadata);
  if (current === seatsCount) return;
  try {
    await stripeClient.subscriptions.update(subscription.id, {
      metadata: {
        ...(subscription.metadata || {}),
        seats_count: seatsCount.toString(),
      },
    });
  } catch (error) {
    console.warn('Failed to sync Stripe seats_count metadata:', error);
  }
};

const syncStripeSeatMetadata = async (subscription: Stripe.Subscription, seatsCount: number) => {
  await syncStripeSeatMetadataWithClient(requireStripe(), subscription, seatsCount);
};

const extractInvoiceFromLatestInvoice = (
  latestInvoice: Stripe.Subscription['latest_invoice']
): Stripe.Invoice | null => {
  if (!latestInvoice || typeof latestInvoice === 'string') return null;
  return latestInvoice as Stripe.Invoice;
};

const extractNextActionUrlFromInvoice = (invoice: Stripe.Invoice | null): string | null => {
  if (!invoice) return null;
  if (invoice.hosted_invoice_url) return invoice.hosted_invoice_url;

  const paymentIntent = (
    invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null }
  ).payment_intent;
  if (paymentIntent && typeof paymentIntent !== 'string') {
    const nextAction = paymentIntent.next_action;
    if (nextAction?.type === 'redirect_to_url') {
      return nextAction.redirect_to_url?.url || null;
    }
  }

  return null;
};

const extractNextActionUrlFromStripeError = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  const raw = (error as { raw?: Record<string, unknown> }).raw;
  if (!raw || typeof raw !== 'object') return null;

  const invoice = raw.invoice as { hosted_invoice_url?: unknown } | undefined;
  if (typeof invoice?.hosted_invoice_url === 'string') {
    return invoice.hosted_invoice_url;
  }

  const paymentIntent = raw.payment_intent as {
    next_action?: {
      type?: unknown;
      redirect_to_url?: {
        url?: unknown;
      };
    };
  } | undefined;

  if (paymentIntent?.next_action?.type === 'redirect_to_url') {
    const redirectUrl = paymentIntent.next_action.redirect_to_url?.url;
    return typeof redirectUrl === 'string' ? redirectUrl : null;
  }

  return null;
};

const insertBillingEventSafe = async ({
  eventType,
  merchantId,
  subscriptionId = null,
  providerEventId = null,
  payload,
  processed = true,
  error = null,
}: SeatUpdateEventPayload) => {
  try {
    await requireSupabase()
      .from('billing_events')
      .insert({
        event_type: eventType,
        provider: 'stripe',
        provider_event_id: providerEventId,
        merchant_id: merchantId,
        subscription_id: subscriptionId,
        payload,
        processed,
        error,
      });
  } catch (insertError) {
    console.warn('Failed to insert billing event:', insertError);
  }
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
    const result = await requireStripe().subscriptions.search({ query, limit: 50 });
    return result.data ?? [];
  } catch (error) {
    console.warn('Stripe subscription search failed:', error);
    return [];
  }
};

const listSubscriptionsForCustomer = async (customerId: string) => {
  try {
    const result = await requireStripe().subscriptions.list({
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
      return await requireStripe().subscriptions.retrieve(fallbackSubscriptionId);
    } catch (error) {
      console.warn('Stripe subscription retrieve failed:', error);
    }
  }

  return null;
};

const buildSubscriptionUpdatesFromStripe = (subscription: Stripe.Subscription) => {
  const status = mapStripeStatus(subscription);
  const cancelAtPeriodEnd = Boolean(
    subscription.cancel_at_period_end || subscription.cancel_at
  );
  const item0 = subscription.items?.data?.[0] as
    | { current_period_start?: number | null; current_period_end?: number | null }
    | undefined;
  const subPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const currentPeriodStart =
    subPeriod.current_period_start ?? item0?.current_period_start ?? null;
  const currentPeriodEnd =
    subPeriod.current_period_end ?? item0?.current_period_end ?? null;
  const seatsCount = deriveSeatsCount(subscription);
  const updates: Record<string, unknown> = {
    status,
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

  return { updates, seatsCount };
};

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

const extractCardPaymentMethodSummary = (
  paymentMethod: Stripe.PaymentMethod | null
): BillingPaymentMethodSummary | null => {
  if (!paymentMethod || paymentMethod.type !== 'card') return null;
  return {
    type: 'card',
    brand: paymentMethod.card?.display_brand || paymentMethod.card?.brand || null,
    last4: paymentMethod.card?.last4 || null,
  };
};

const resolvePaymentMethodById = async (paymentMethodId: string) => {
  try {
    const paymentMethod = await requireStripe().paymentMethods.retrieve(paymentMethodId);
    return extractCardPaymentMethodSummary(paymentMethod as Stripe.PaymentMethod);
  } catch (error) {
    console.warn('Failed to retrieve Stripe payment method:', error);
    return null;
  }
};

const resolveBillingPaymentMethodSummary = async (
  merchantId: string,
  providerCustomerId?: string | null,
  providerSubscriptionId?: string | null,
): Promise<BillingPaymentMethodSummary | null> => {
  if (!stripe) return null;

  try {
    const resolvedSubscription = await resolveStripeSubscriptionForMerchant(
      merchantId,
      providerSubscriptionId,
      providerCustomerId,
    );

    const subscriptionDefault = resolvedSubscription?.default_payment_method;
    if (subscriptionDefault && typeof subscriptionDefault !== 'string') {
      const fromSubscription = extractCardPaymentMethodSummary(subscriptionDefault);
      if (fromSubscription) return fromSubscription;
    }
    if (typeof subscriptionDefault === 'string') {
      const fromSubscription = await resolvePaymentMethodById(subscriptionDefault);
      if (fromSubscription) return fromSubscription;
    }

    const customerId = resolvedSubscription
      ? (typeof resolvedSubscription.customer === 'string'
        ? resolvedSubscription.customer
        : resolvedSubscription.customer?.id)
      : providerCustomerId;

    if (!customerId) return null;

    const customer = await requireStripe().customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    if (customer.deleted) return null;

    const customerDefault = customer.invoice_settings?.default_payment_method;
    if (customerDefault && typeof customerDefault !== 'string') {
      return extractCardPaymentMethodSummary(customerDefault as Stripe.PaymentMethod);
    }
    if (typeof customerDefault === 'string') {
      return resolvePaymentMethodById(customerDefault);
    }
  } catch (error) {
    console.warn('Failed to resolve billing payment method summary:', error);
  }

  return null;
};

export async function executeSeatUpdate(
  input: SeatUpdateExecutionInput,
  deps: SeatUpdateExecutionDependencies
): Promise<{ statusCode: number; body: SeatUpdateApiResponse }> {
  const {
    merchantId,
    seatCount,
    activeStaffCount,
    subscriptionRecord,
  } = input;

  if (subscriptionRecord.billing_provider !== 'stripe') {
    return {
      statusCode: 400,
      body: {
        error: 'Seat management in-app is only available for Stripe subscriptions.',
        code: 'UNSUPPORTED_BILLING_PROVIDER',
      },
    };
  }

  if (seatCount < activeStaffCount) {
    return {
      statusCode: 400,
      body: {
        error: `Cannot reduce seats below active staff count (${activeStaffCount})`,
        code: 'SEATS_BELOW_STAFF',
      },
    };
  }

  const resolvedSubscription = await deps.resolveSubscription(
    merchantId,
    subscriptionRecord.provider_subscription_id,
    subscriptionRecord.provider_customer_id
  );

  if (!resolvedSubscription) {
    return {
      statusCode: 404,
      body: {
        error: 'Stripe subscription not found for this merchant.',
        code: 'STRIPE_SUBSCRIPTION_NOT_FOUND',
      },
    };
  }

  const currentSeats = deriveSeatsCount(resolvedSubscription);
  const seatItem = findSeatSubscriptionItem(resolvedSubscription);

  if (!seatItem) {
    await deps.logEvent({
      eventType: 'stripe.seat_update.result',
      merchantId,
      subscriptionId: subscriptionRecord.id,
      providerEventId: resolvedSubscription.id,
      payload: {
        status: 'failed',
        reason: 'seat_item_not_found',
        seatCountRequested: seatCount,
        seatCountEffective: currentSeats,
      },
      processed: false,
      error: 'Unable to locate staff seat item on subscription.',
    });
    return {
      statusCode: 400,
      body: {
        error: 'Unable to locate the staff seat item on this Stripe subscription.',
        code: 'STRIPE_SEAT_ITEM_NOT_FOUND',
      },
    };
  }

  if (seatCount === currentSeats) {
    const { updates } = buildSubscriptionUpdatesFromStripe(resolvedSubscription);
    await deps.persistSubscription(merchantId, updates);
    return {
      statusCode: 200,
      body: {
        status: 'noop',
        seatCountRequested: seatCount,
        seatCountEffective: currentSeats,
        message: 'Seat count is already up to date.',
      },
    };
  }

  await deps.logEvent({
    eventType: 'stripe.seat_update.attempt',
    merchantId,
    subscriptionId: subscriptionRecord.id,
    providerEventId: resolvedSubscription.id,
    payload: {
      seatCountRequested: seatCount,
      seatCountCurrent: currentSeats,
      stripeSubscriptionId: resolvedSubscription.id,
      seatItemId: seatItem.id,
      isTrialing: resolvedSubscription.status === 'trialing' || subscriptionRecord.status === 'trialing',
    },
  });

  const isTrialing = subscriptionRecord.status === 'trialing'
    || resolvedSubscription.status === 'trialing';
  let updatedStripeSubscription: Stripe.Subscription;
  let responseStatus: SeatUpdateStatus = 'applied';

  if (isTrialing) {
    updatedStripeSubscription = await deps.stripeClient.subscriptions.update(
      resolvedSubscription.id,
      {
        items: [{ id: seatItem.id, quantity: seatCount }],
        proration_behavior: 'none',
        expand: ['latest_invoice', 'latest_invoice.payment_intent'],
      }
    );
  } else {
    try {
      updatedStripeSubscription = await deps.stripeClient.subscriptions.update(
        resolvedSubscription.id,
        {
          items: [{ id: seatItem.id, quantity: seatCount }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
          expand: ['latest_invoice', 'latest_invoice.payment_intent'],
        }
      );
    } catch (stripeError) {
      const message = stripeError instanceof Error ? stripeError.message : 'Payment required';
      const nextActionUrl = extractNextActionUrlFromStripeError(stripeError);

      await deps.logEvent({
        eventType: 'stripe.seat_update.result',
        merchantId,
        subscriptionId: subscriptionRecord.id,
        providerEventId: resolvedSubscription.id,
        payload: {
          status: 'pending_payment',
          seatCountRequested: seatCount,
          seatCountEffective: currentSeats,
          seatCountPending: seatCount,
          nextActionUrl,
        },
        processed: false,
        error: message,
      });

      return {
        statusCode: 402,
        body: {
          error: message,
          code: 'PAYMENT_REQUIRED',
          status: 'pending_payment',
          seatCountRequested: seatCount,
          seatCountEffective: currentSeats,
          seatCountPending: seatCount,
          ...(nextActionUrl ? { nextActionUrl } : {}),
          message: 'Payment confirmation is required before this seat increase can be applied.',
        },
      };
    }

    if (updatedStripeSubscription.pending_update) {
      responseStatus = 'pending_payment';
    }
  }

  let effectiveSeats = deriveSeatsCount(updatedStripeSubscription);
  if (responseStatus === 'applied' && effectiveSeats !== seatCount) {
    const refreshed = await deps.stripeClient.subscriptions.retrieve(
      updatedStripeSubscription.id,
      { expand: ['latest_invoice', 'latest_invoice.payment_intent'] }
    );
    updatedStripeSubscription = refreshed;
    effectiveSeats = deriveSeatsCount(updatedStripeSubscription);
    if (effectiveSeats !== seatCount) {
      responseStatus = 'pending_payment';
    }
  }

  const { updates } = buildSubscriptionUpdatesFromStripe(updatedStripeSubscription);
  await deps.persistSubscription(merchantId, updates);

  if (responseStatus === 'applied') {
    await deps.syncSeatMetadata(updatedStripeSubscription, effectiveSeats);
  }

  const invoice = extractInvoiceFromLatestInvoice(updatedStripeSubscription.latest_invoice);
  const nextActionUrl = extractNextActionUrlFromInvoice(invoice);
  const invoiceId = invoice?.id;

  await deps.logEvent({
    eventType: 'stripe.seat_update.result',
    merchantId,
    subscriptionId: subscriptionRecord.id,
    providerEventId: updatedStripeSubscription.id,
    payload: {
      status: responseStatus,
      seatCountRequested: seatCount,
      seatCountEffective: effectiveSeats,
      seatCountPending: responseStatus === 'pending_payment' ? seatCount : null,
      invoiceId: invoiceId || null,
      nextActionUrl,
      stripeSubscriptionId: updatedStripeSubscription.id,
    },
    processed: responseStatus === 'applied',
    error: responseStatus === 'pending_payment'
      ? 'Payment confirmation required before seat increase can be applied.'
      : null,
  });

  return {
    statusCode: 200,
    body: {
      status: responseStatus,
      seatCountRequested: seatCount,
      seatCountEffective: effectiveSeats,
      ...(responseStatus === 'pending_payment' ? { seatCountPending: seatCount } : {}),
      ...(invoiceId ? { invoiceId } : {}),
      ...(nextActionUrl ? { nextActionUrl } : {}),
      message: responseStatus === 'pending_payment'
        ? 'Payment confirmation is required before this seat increase can be applied.'
        : 'Seat count updated successfully.',
    },
  };
}

async function getOrCreateStripeCustomer(merchantId: string, email?: string): Promise<string> {
  // Check if merchant already has a Stripe customer ID
  const { data: subscription } = await requireSupabase()
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('merchant_id', merchantId)
    .eq('billing_provider', 'stripe')
    .single();

  const { data: profile } = await requireSupabase()
    .from('profiles')
    .select('business_name, phone, email')
    .eq('id', merchantId)
    .single();

  const normalizedEmail = (email || profile?.email || '').trim() || undefined;
  const normalizedPhone = profile?.phone || undefined;

  if (subscription?.provider_customer_id) {
    if (normalizedEmail || normalizedPhone) {
      const updates: Stripe.CustomerUpdateParams = {};
      if (normalizedEmail) updates.email = normalizedEmail;
      if (normalizedPhone) updates.phone = normalizedPhone;
      if (Object.keys(updates).length > 0) {
        await requireStripe().customers.update(subscription.provider_customer_id, updates);
      }
    }
    return subscription.provider_customer_id;
  }

  // Create new Stripe customer
  const customer = await requireStripe().customers.create({
    email: normalizedEmail,
    name: profile?.business_name || undefined,
    phone: normalizedPhone,
    metadata: {
      merchant_id: merchantId,
    },
  });

  return customer.id;
}

async function getPlanPriceIds(
  planId: string,
  cadence: 'monthly' | 'annual' = 'monthly'
): Promise<{ priceId: string; productId: string } | null> {
  const { data: plan } = await requireSupabase()
    .from('plans')
    .select('stripe_price_id, stripe_annual_price_id, stripe_product_id')
    .eq('id', planId)
    .single();

  const resolvedPriceId = cadence === 'annual'
    ? plan?.stripe_annual_price_id || plan?.stripe_price_id
    : plan?.stripe_price_id;

  if (!resolvedPriceId || !plan?.stripe_product_id) {
    return null;
  }

  return {
    priceId: resolvedPriceId,
    productId: plan.stripe_product_id,
  };
}

async function claimOneTimeTrialEligibility(merchantId: string): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('claim_one_time_trial_eligibility', {
    p_merchant_id: merchantId,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

// ============================================
// Stripe Routes
// ============================================

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout session for a new subscription
 */
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const body = CreateCheckoutSchema.parse(req.body);
    const { merchantId, planId, successUrl, cancelUrl, email, seatsCount, billingCadence } = body;

    // Get plan details
    const resolvedCadence = billingCadence || 'monthly';
    const planPrices = await getPlanPriceIds(planId, resolvedCadence);
    if (!planPrices) {
      return res.status(400).json({ 
        error: 'Invalid plan or plan not configured in Stripe',
        code: 'PLAN_NOT_FOUND'
      });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(merchantId, email);

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    const staffPriceId = resolvedCadence === 'annual'
      ? 'price_1SqTURGXlKB5nE0wCBcgK7sV'
      : 'price_1SqSvwGXlKB5nE0whqwMF8h9';
    const resolvedSeats = seatsCount || 1;

    if (planPrices.priceId === staffPriceId) {
      lineItems.push({
        price: planPrices.priceId,
        quantity: resolvedSeats,
      });
    } else {
      lineItems.push({
        price: planPrices.priceId,
        quantity: 1,
      });
      lineItems.push({
        price: staffPriceId,
        quantity: resolvedSeats,
      });
    }

    const successUrlWithSession = successUrl.includes('?')
      ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
      : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

    const trialEligibleClaimed = await claimOneTimeTrialEligibility(merchantId);
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        merchant_id: merchantId,
        plan_id: planId,
        seats_count: resolvedSeats.toString(),
        billing_cadence: resolvedCadence,
      },
    };

    if (trialEligibleClaimed) {
      subscriptionData.trial_period_days = 30;
    }

    console.info('[billing:create-checkout-session] trial decision', {
      merchant_id: merchantId,
      endpoint: 'create-checkout-session',
      trial_eligible_claimed: trialEligibleClaimed,
      stripe_mode: trialEligibleClaimed ? 'trial' : 'no_trial',
    });

    // Create checkout session
    const session = await requireStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: successUrlWithSession,
      cancel_url: cancelUrl,
      subscription_data: subscriptionData,
      metadata: {
        merchant_id: merchantId,
        plan_id: planId,
        seats_count: resolvedSeats.toString(),
        billing_cadence: resolvedCadence,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    const { data: existingSubscription } = await requireSupabase()
      .from('subscriptions')
      .select('status')
      .eq('merchant_id', merchantId)
      .single();

    const nextStatus = existingSubscription?.status === 'canceled'
      ? 'canceled'
      : 'incomplete';

    // Update subscription record with customer ID
    await requireSupabase()
      .from('subscriptions')
      .upsert({
        merchant_id: merchantId,
        billing_provider: 'stripe',
        provider_customer_id: customerId,
        plan_id: planId,
        status: nextStatus, // Will be updated via webhook
        seats_count: resolvedSeats,
      }, {
        onConflict: 'merchant_id',
      });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Creates a Stripe Billing Portal session for managing subscription
 */
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const body = CreatePortalSchema.parse(req.body);
    const { merchantId, returnUrl } = body;

    // Get subscription with customer ID
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('provider_customer_id, provider_subscription_id')
      .eq('merchant_id', merchantId)
      .eq('billing_provider', 'stripe')
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'No Stripe subscription found for this merchant',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    const resolvedSubscription = await resolveStripeSubscriptionForMerchant(
      merchantId,
      subscription.provider_subscription_id,
      subscription.provider_customer_id
    );

    if (resolvedSubscription) {
      const { updates, seatsCount } = buildSubscriptionUpdatesFromStripe(resolvedSubscription);
      await requireSupabase()
        .from('subscriptions')
        .update(updates)
        .eq('merchant_id', merchantId);
      await syncStripeSeatMetadata(resolvedSubscription, seatsCount);
    }

    const portalCustomerId = resolvedSubscription
      ? (typeof resolvedSubscription.customer === 'string'
        ? resolvedSubscription.customer
        : resolvedSubscription.customer?.id)
      : subscription.provider_customer_id;

    if (!portalCustomerId) {
      return res.status(404).json({
        error: 'No Stripe customer found for this merchant',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    // Create portal session
    const session = await requireStripe().billingPortal.sessions.create({
      customer: portalCustomerId,
      return_url: returnUrl,
      ...(PORTAL_CONFIG_ID ? { configuration: PORTAL_CONFIG_ID } : {}),
    });

    res.json({
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * POST /api/billing/update-seats
 * Updates the seat count for a Stripe subscription.
 * 1 seat = quantity 1 on the seat subscription item.
 */
router.post('/update-seats', async (req: Request, res: Response) => {
  try {
    const body = UpdateSeatsSchema.parse(req.body);
    const { merchantId, seatCount } = body;

    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    const { count: activeStaff } = await requireSupabase()
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('active', true);

    const stripeClient = requireStripe();
    const result = await executeSeatUpdate(
      {
        merchantId,
        seatCount,
        activeStaffCount: activeStaff ?? 0,
        subscriptionRecord: {
          id: subscription.id,
          merchant_id: subscription.merchant_id,
          status: subscription.status,
          seats_count: subscription.seats_count,
          billing_provider: subscription.billing_provider,
          provider_subscription_id: subscription.provider_subscription_id,
          provider_customer_id: subscription.provider_customer_id,
        },
      },
      {
        stripeClient,
        resolveSubscription: resolveStripeSubscriptionForMerchant,
        persistSubscription: async (targetMerchantId, updates) => {
          await requireSupabase()
            .from('subscriptions')
            .update(updates)
            .eq('merchant_id', targetMerchantId);
        },
        syncSeatMetadata: async (stripeSubscription, seatsCountValue) => {
          await syncStripeSeatMetadataWithClient(stripeClient, stripeSubscription, seatsCountValue);
        },
        logEvent: insertBillingEventSafe,
      }
    );

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Error updating seats:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update seats' });
  }
});

/**
 * POST /api/billing/report-sms-usage
 * Reports SMS usage for metered billing (Starter plan only)
 */
router.post('/report-sms-usage', async (req: Request, res: Response) => {
  try {
    const body = ReportSmsUsageSchema.parse(req.body);
    const { merchantId, count } = body;

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    // Increment SMS usage in database
    const { data: newCount } = await requireSupabase().rpc('increment_sms_usage', {
      p_subscription_id: subscription.id,
      p_count: count,
    });

    // Check if overage applies (Starter only, > 300 SMS)
    const smsIncluded = subscription.plans?.sms_included || 300;
    const isUnlimited = subscription.plans?.is_unlimited_sms || false;
    const currentUsage = newCount || count;

    let overageUnits = 0;
    if (!isUnlimited && currentUsage > smsIncluded) {
      // Calculate overage in units of 100
      overageUnits = Math.ceil((currentUsage - smsIncluded) / 100);
    }

    // Report to Stripe if there's overage and using Stripe
    if (overageUnits > 0 && subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      // In production, you'd report metered usage to Stripe here
      // stripe.subscriptionItems.createUsageRecord(...)
      console.log(`SMS overage for merchant ${merchantId}: ${overageUnits} units of 100`);
    }

    res.json({
      success: true,
      currentUsage,
      included: isUnlimited ? 'unlimited' : smsIncluded,
      overage: overageUnits,
      overageCost: isUnlimited ? 0 : overageUnits * (subscription.plans?.sms_overage_price_per_100 || 200) / 100,
    });
  } catch (error) {
    console.error('Error reporting SMS usage:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to report SMS usage' });
  }
});

/**
 * POST /api/billing/cancel-subscription
 * Cancels a subscription (at period end or immediately)
 */
router.post('/cancel-subscription', async (req: Request, res: Response) => {
  try {
    const body = CancelSubscriptionSchema.parse(req.body);
    const { merchantId, immediately } = body;

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    let effectivePeriodEndIso: string | null | undefined;

    if (subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      if (immediately) {
        await requireStripe().subscriptions.cancel(subscription.provider_subscription_id);
      } else {
        await requireStripe().subscriptions.update(subscription.provider_subscription_id, {
          cancel_at_period_end: true,
        });
      }

      const stripeSubscription = await requireStripe().subscriptions.retrieve(
        subscription.provider_subscription_id,
      );
      const { updates, seatsCount } = buildSubscriptionUpdatesFromStripe(stripeSubscription);
      await requireSupabase()
        .from('subscriptions')
        .update(updates)
        .eq('merchant_id', merchantId);
      await syncStripeSeatMetadata(stripeSubscription, seatsCount);
      effectivePeriodEndIso = updates.current_period_end as string | undefined;
    } else {
      await requireSupabase()
        .from('subscriptions')
        .update({
          cancel_at_period_end: !immediately,
          canceled_at: immediately ? new Date().toISOString() : null,
          status: immediately ? 'canceled' : subscription.status,
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_id', merchantId);
    }

    res.json({
      success: true,
      canceledImmediately: immediately,
      effectiveDate: immediately
        ? new Date().toISOString()
        : effectivePeriodEndIso ?? subscription.current_period_end,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/billing/pause-subscription
 * Pauses a subscription for up to 3 months
 */
router.post('/pause-subscription', async (req: Request, res: Response) => {
  try {
    const body = PauseSubscriptionSchema.parse(req.body);
    const { merchantId, pauseMonths } = body;

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({ 
        error: 'Can only pause active subscriptions',
        code: 'INVALID_STATUS'
      });
    }

    const resumeDate = new Date();
    resumeDate.setMonth(resumeDate.getMonth() + pauseMonths);

    if (subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      // Pause subscription in Stripe
      await requireStripe().subscriptions.update(subscription.provider_subscription_id, {
        pause_collection: {
          behavior: 'void',
          resumes_at: Math.floor(resumeDate.getTime() / 1000),
        },
      });
    }

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        pause_resumes_at: resumeDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      pausedUntil: resumeDate.toISOString(),
    });
  } catch (error) {
    console.error('Error pausing subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to pause subscription' });
  }
});

/**
 * POST /api/billing/resume-subscription
 * Resumes a paused subscription
 */
router.post('/resume-subscription', async (req: Request, res: Response) => {
  try {
    const { merchantId } = z.object({ merchantId: z.string().uuid() }).parse(req.body);

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    if (subscription.status !== 'paused') {
      return res.status(400).json({ 
        error: 'Subscription is not paused',
        code: 'INVALID_STATUS'
      });
    }

    if (subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      // Resume subscription in Stripe
      const updateParams = {
        pause_collection: '', // Empty string removes pause
      } as Stripe.SubscriptionUpdateParams;
      await requireStripe().subscriptions.update(subscription.provider_subscription_id, updateParams);
    }

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        status: 'active',
        paused_at: null,
        pause_resumes_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      status: 'active',
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

/**
 * POST /api/billing/upgrade-plan
 * Upgrades from Starter to Pro (immediate proration)
 */
router.post('/upgrade-plan', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      merchantId: z.string().uuid(),
      newPlanId: z.enum(['starter', 'pro']),
    }).parse(req.body);

    const { merchantId, newPlanId } = body;

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    if (subscription.plan_id === newPlanId) {
      return res.status(400).json({ 
        error: 'Already on this plan',
        code: 'SAME_PLAN'
      });
    }

    // Get new plan price
    const planPrices = await getPlanPriceIds(newPlanId);
    if (!planPrices) {
      return res.status(400).json({ 
        error: 'New plan not configured',
        code: 'PLAN_NOT_FOUND'
      });
    }

    if (subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      // Get current subscription
      const stripeSubscription = await requireStripe().subscriptions.retrieve(
        subscription.provider_subscription_id
      );

      // Update subscription with new price (prorated)
      await requireStripe().subscriptions.update(subscription.provider_subscription_id, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: planPrices.priceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          plan_id: newPlanId,
        },
      });
    }

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        plan_id: newPlanId,
        // Reset seats for Pro (Pro includes 10)
        seats_count: newPlanId === 'pro' ? 10 : subscription.seats_count,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      newPlanId,
      message: subscription.plan_id === 'starter' && newPlanId === 'pro'
        ? 'Upgraded to Pro! Seat charges removed, unlimited SMS activated.'
        : 'Plan changed successfully.',
    });
  } catch (error) {
    console.error('Error upgrading plan:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

/**
 * GET /api/billing/subscription/:merchantId
 * Gets the current subscription status for a merchant
 */
router.get('/subscription/:merchantId', async (req: Request, res: Response) => {
  try {
    const merchantId = z.string().uuid().parse(req.params.merchantId);

    // Get subscription with plan details
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    // Get current SMS usage
    const { data: smsUsage } = await requireSupabase().rpc('get_current_sms_usage', {
      p_subscription_id: subscription.id,
    });

    // Get trial status
    const { data: trialStatus } = await requireSupabase().rpc('check_trial_status', {
      p_merchant_id: merchantId,
    });

    // Get active staff count
    const { count: activeStaff } = await requireSupabase()
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('active', true);

    const paymentMethod = subscription.billing_provider === 'stripe'
      ? await resolveBillingPaymentMethodSummary(
        merchantId,
        subscription.provider_customer_id,
        subscription.provider_subscription_id,
      )
      : null;

    res.json({
      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
        planName: subscription.plans?.name,
        status: subscription.status,
        billingProvider: subscription.billing_provider,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        pausedAt: subscription.paused_at,
        pauseResumesAt: subscription.pause_resumes_at,
      },
      plan: subscription.plans,
      usage: {
        sms: {
          used: smsUsage || 0,
          included: subscription.plans?.is_unlimited_sms ? 'unlimited' : subscription.plans?.sms_included,
          overage: subscription.plans?.is_unlimited_sms 
            ? 0 
            : Math.max(0, (smsUsage || 0) - (subscription.plans?.sms_included || 300)),
        },
        seats: {
          used: activeStaff || 1,
          included: subscription.plans?.staff_included,
          additional: Math.max(0, (subscription.seats_count || 1) - (subscription.plans?.staff_included || 1)),
          total: subscription.seats_count,
        },
      },
      trial: trialStatus?.[0] || null,
      paymentMethod,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid merchant ID' });
    }
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/billing/reconcile-subscription
 * Fetches the current Stripe subscription state and updates the local record.
 */
router.post('/reconcile-subscription', async (req: Request, res: Response) => {
  try {
    const { merchantId } = ReconcileSubscriptionSchema.parse(req.body);

    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.billing_provider !== 'stripe' || !subscription.provider_subscription_id) {
      const resolvedFallback = await resolveStripeSubscriptionForMerchant(
        merchantId,
        subscription.provider_subscription_id,
        subscription.provider_customer_id
      );
      if (!resolvedFallback) {
        return res.json({ subscription });
      }
      const { updates, seatsCount } = buildSubscriptionUpdatesFromStripe(resolvedFallback);
      const { data: updatedFallback, error: fallbackError } = await requireSupabase()
        .from('subscriptions')
        .update(updates)
        .eq('merchant_id', merchantId)
        .select('*')
        .single();
      if (fallbackError) {
        return res.status(500).json({ error: 'Failed to update subscription' });
      }
      await syncStripeSeatMetadata(resolvedFallback, seatsCount);
      return res.json({ subscription: updatedFallback });
    }

    let stripeSubscription: Stripe.Subscription;
    try {
      const resolvedSubscription = await resolveStripeSubscriptionForMerchant(
        merchantId,
        subscription.provider_subscription_id,
        subscription.provider_customer_id
      );
      if (!resolvedSubscription) {
        return res.json({ subscription });
      }
      stripeSubscription = resolvedSubscription;
    } catch (stripeError: unknown) {
      const stripeErrorCode = typeof stripeError === 'object' && stripeError
        ? (stripeError as { code?: string }).code
        : undefined;
      if (stripeErrorCode === 'resource_missing') {
        const { data: updated, error: updateError } = await requireSupabase()
          .from('subscriptions')
          .update({
            status: 'canceled',
            provider_subscription_id: null,
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('merchant_id', merchantId)
          .select('*')
          .single();

        if (updateError) {
          return res.status(500).json({ error: 'Failed to update subscription' });
        }

        return res.json({ subscription: updated });
      }

      throw stripeError;
    }

    const { updates, seatsCount } = buildSubscriptionUpdatesFromStripe(stripeSubscription);

    const { data: updated, error: updateError } = await requireSupabase()
      .from('subscriptions')
      .update(updates)
      .eq('merchant_id', merchantId)
      .select('*')
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    await syncStripeSeatMetadata(stripeSubscription, seatsCount);
    return res.json({ subscription: updated });
  } catch (error) {
    console.error('Error reconciling subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to reconcile subscription' });
  }
});

/**
 * GET /api/billing/plans
 * Gets all available plans
 */
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const { data: plans, error } = await requireSupabase()
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ============================================
// Embedded Stripe Checkout (Payment Element)
// ============================================

const CreateEmbeddedCheckoutSchema = z.object({
  merchantId: z.string().uuid(),
  planId: z.enum(['starter', 'pro']),
  email: z.string().email().optional(),
});

/**
 * POST /api/billing/create-embedded-checkout
 * Creates a subscription with incomplete status and returns client secret
 * for embedded Payment Element checkout (no redirect)
 */
router.post('/create-embedded-checkout', async (req: Request, res: Response) => {
  try {
    const body = CreateEmbeddedCheckoutSchema.parse(req.body);
    const { merchantId, planId, email } = body;

    // Get plan details
    const planPrices = await getPlanPriceIds(planId);
    if (!planPrices) {
      return res.status(400).json({ 
        error: 'Plan not configured. Please set up Stripe products in dashboard.',
        code: 'PLAN_NOT_CONFIGURED'
      });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(merchantId, email);

    const trialEligibleClaimed = await claimOneTimeTrialEligibility(merchantId);
    const stripeSubscriptionCreateParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: planPrices.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        merchant_id: merchantId,
        plan_id: planId,
      },
    };

    if (trialEligibleClaimed) {
      stripeSubscriptionCreateParams.trial_period_days = 30;
    }

    console.info('[billing:create-embedded-checkout] trial decision', {
      merchant_id: merchantId,
      endpoint: 'create-embedded-checkout',
      trial_eligible_claimed: trialEligibleClaimed,
      stripe_mode: trialEligibleClaimed ? 'trial' : 'no_trial',
    });

    // Create subscription with incomplete status
    // This creates the subscription but doesn't charge until payment is confirmed
    const subscription = await requireStripe().subscriptions.create(stripeSubscriptionCreateParams);

    // Get the client secret from the payment intent
    // The expand option above ensures these are full objects, not just IDs
    const invoice = subscription.latest_invoice as Stripe.Invoice & { payment_intent: Stripe.PaymentIntent };
    const paymentIntent = invoice?.payment_intent;

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to create payment intent');
    }

    // Update subscription record
    await requireSupabase()
      .from('subscriptions')
      .upsert({
        merchant_id: merchantId,
        billing_provider: 'stripe',
        provider_customer_id: customerId,
        provider_subscription_id: subscription.id,
        plan_id: planId,
        status: 'incomplete',
      }, {
        onConflict: 'merchant_id',
      });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
    });
  } catch (error) {
    console.error('Error creating embedded checkout:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

/**
 * POST /api/billing/confirm-subscription
 * Confirms subscription is active after payment element completion
 */
router.post('/confirm-subscription', async (req: Request, res: Response) => {
  try {
    const { subscriptionId, merchantId } = z.object({
      subscriptionId: z.string(),
      merchantId: z.string().uuid(),
    }).parse(req.body);

    // Get subscription from Stripe
    const subscription = await requireStripe().subscriptions.retrieve(subscriptionId);
    const stripeSubscription = subscription as Stripe.Subscription & {
      current_period_start?: number | null;
      current_period_end?: number | null;
    };
    
    // Access period dates from the subscription
    const { current_period_start: periodStart, current_period_end: periodEnd } = stripeSubscription;

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        status: stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing' 
          ? stripeSubscription.status 
          : 'incomplete',
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      status: subscription.status,
    });
  } catch (error) {
    console.error('Error confirming subscription:', error);
    res.status(500).json({ error: 'Failed to confirm subscription' });
  }
});

export default router;
