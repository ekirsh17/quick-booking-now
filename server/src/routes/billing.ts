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

// ============================================
// Helper Functions
// ============================================

const toIsoFromSeconds = (seconds?: number | null) => (
  typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null
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

    // Create checkout session
    const session = await requireStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: successUrlWithSession,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 30, // Value guarantee trial
        metadata: {
          merchant_id: merchantId,
          plan_id: planId,
          seats_count: resolvedSeats.toString(),
          billing_cadence: resolvedCadence,
        },
      },
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
      .select('provider_customer_id')
      .eq('merchant_id', merchantId)
      .eq('billing_provider', 'stripe')
      .single();

    if (error || !subscription?.provider_customer_id) {
      return res.status(404).json({ 
        error: 'No Stripe subscription found for this merchant',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    // Create portal session
    const session = await requireStripe().billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
      return_url: returnUrl,
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
 * Updates the seat count for a Starter plan subscription
 */
router.post('/update-seats', async (req: Request, res: Response) => {
  try {
    const body = UpdateSeatsSchema.parse(req.body);
    const { merchantId, seatCount } = body;

    // Get current subscription
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

    // Only Starter plan has seat billing
    if (subscription.plan_id !== 'starter') {
      return res.status(400).json({ 
        error: 'Seat management is only available for Starter plan',
        code: 'INVALID_PLAN'
      });
    }

    // Check if reducing below current active staff
    const { count: activeStaff } = await requireSupabase()
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('billable', true);

    if (seatCount < (activeStaff || 1)) {
      return res.status(400).json({ 
        error: `Cannot reduce seats below active staff count (${activeStaff})`,
        code: 'SEATS_BELOW_STAFF'
      });
    }

    // Calculate additional seats (1 is included in Starter)
    const additionalSeats = Math.max(0, seatCount - 1);
    const staffAddonPrice = subscription.plans?.staff_addon_price;

    if (subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      // Get current Stripe subscription
      const stripeSubscription = await requireStripe().subscriptions.retrieve(
        subscription.provider_subscription_id
      );

      // Find or add staff seat line item
      const existingItems = stripeSubscription.items.data;
      
      // Get staff addon price ID from plans table
      const { data: starterPlan } = await requireSupabase()
        .from('plans')
        .select('stripe_price_id')
        .eq('id', 'starter')
        .single();

      // Note: In production, you'd have a separate price for staff seats
      // For now, update the subscription metadata
      await requireStripe().subscriptions.update(subscription.provider_subscription_id, {
        metadata: {
          seats_count: seatCount.toString(),
          additional_seats: additionalSeats.toString(),
        },
        proration_behavior: 'create_prorations',
      });
    }

    // Update local subscription record
    await requireSupabase()
      .from('subscriptions')
      .update({
        seats_count: seatCount,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      seatCount,
      additionalSeats,
      monthlyAdditionalCost: additionalSeats * (staffAddonPrice || 1000) / 100,
    });
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

    if (subscription.billing_provider === 'stripe' && subscription.provider_subscription_id) {
      if (immediately) {
        // Cancel immediately
        await requireStripe().subscriptions.cancel(subscription.provider_subscription_id);
      } else {
        // Cancel at period end
        await requireStripe().subscriptions.update(subscription.provider_subscription_id, {
          cancel_at_period_end: true,
        });
      }
    }

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        cancel_at_period_end: !immediately,
        canceled_at: immediately ? new Date().toISOString() : null,
        status: immediately ? 'canceled' : subscription.status,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      canceledImmediately: immediately,
      effectiveDate: immediately 
        ? new Date().toISOString() 
        : subscription.current_period_end,
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
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('billable', true);

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
      return res.json({ subscription });
    }

    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await requireStripe().subscriptions.retrieve(
        subscription.provider_subscription_id
      );
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

    const status = mapStripeStatus(stripeSubscription);
    const cancelAtPeriodEnd = Boolean(
      stripeSubscription.cancel_at_period_end || stripeSubscription.cancel_at
    );
    const currentPeriodStart = (stripeSubscription as Stripe.Subscription & {
      current_period_start?: number | null;
    }).current_period_start ?? null;
    const currentPeriodEnd = (stripeSubscription as Stripe.Subscription & {
      current_period_end?: number | null;
    }).current_period_end ?? null;
    const updates = {
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_start: toIsoFromSeconds(currentPeriodStart),
      current_period_end: toIsoFromSeconds(currentPeriodEnd),
      trial_start: toIsoFromSeconds(stripeSubscription.trial_start as number | null),
      trial_end: toIsoFromSeconds(stripeSubscription.trial_end as number | null),
      canceled_at: toIsoFromSeconds(stripeSubscription.canceled_at as number | null),
      paused_at: stripeSubscription.pause_collection ? new Date().toISOString() : null,
      pause_resumes_at: stripeSubscription.pause_collection?.resumes_at
        ? toIsoFromSeconds(stripeSubscription.pause_collection.resumes_at)
        : null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await requireSupabase()
      .from('subscriptions')
      .update(updates)
      .eq('merchant_id', merchantId)
      .select('*')
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

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

    // Create subscription with incomplete status
    // This creates the subscription but doesn't charge until payment is confirmed
    const subscription = await requireStripe().subscriptions.create({
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
      // Value guarantee trial
      trial_period_days: 30,
    });

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
