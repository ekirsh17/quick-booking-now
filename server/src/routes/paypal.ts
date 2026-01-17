/**
 * PayPal Billing Routes
 * 
 * Handles PayPal subscription creation, capture, and management.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();

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

// PayPal API configuration
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

// ============================================
// Types & Schemas
// ============================================

// ============================================
// Helper Functions
// ============================================

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function getPayPalPlanId(planId: string): Promise<string | null> {
  const { data } = await requireSupabase()
    .from('plans')
    .select('paypal_plan_id')
    .eq('id', planId)
    .single();

  return data?.paypal_plan_id || null;
}

// ============================================
// Routes
// ============================================

/**
 * POST /api/billing/paypal/get-plan-id
 * Returns the PayPal plan ID for embedded checkout (PayPal JS SDK)
 */
router.post('/get-plan-id', async (req: Request, res: Response) => {
  try {
    const { planId, merchantId } = z.object({
      planId: z.enum(['starter', 'pro']),
      merchantId: z.string().uuid(),
    }).parse(req.body);

    // Check if PayPal is configured
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'PayPal is not configured',
        code: 'PAYPAL_NOT_CONFIGURED',
      });
    }

    // Get PayPal plan ID
    const paypalPlanId = await getPayPalPlanId(planId);
    if (!paypalPlanId || paypalPlanId.startsWith('PAYPAL_PLAN_ID_')) {
      return res.status(400).json({
        error: 'PayPal plan not configured. Please set up PayPal products in dashboard.',
        code: 'PLAN_NOT_CONFIGURED',
      });
    }

    res.json({
      paypalPlanId,
      planId,
    });
  } catch (error) {
    console.error('Error getting PayPal plan ID:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to get PayPal plan ID' });
  }
});

/**
 * POST /api/billing/paypal/confirm-subscription
 * Confirms a subscription created via PayPal JS SDK (embedded checkout)
 */
router.post('/confirm-subscription', async (req: Request, res: Response) => {
  try {
    const { subscriptionId, merchantId, planId } = z.object({
      subscriptionId: z.string(),
      merchantId: z.string().uuid(),
      planId: z.enum(['starter', 'pro']),
    }).parse(req.body);

    // Check if PayPal is configured
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'PayPal is not configured',
        code: 'PAYPAL_NOT_CONFIGURED',
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Get subscription details from PayPal
    const subscriptionResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.json();
      console.error('Failed to get PayPal subscription:', errorData);
      return res.status(500).json({
        error: 'Failed to verify PayPal subscription',
      });
    }

    const subscription = await subscriptionResponse.json() as {
      id: string;
      status: string;
      subscriber: {
        payer_id: string;
        email_address?: string;
      };
      billing_info?: {
        next_billing_time?: string;
      };
      start_time?: string;
    };

    // Update subscription in database
    const status = subscription.status === 'ACTIVE' ? 'active' 
      : subscription.status === 'APPROVAL_PENDING' ? 'incomplete'
      : 'trialing';

    await requireSupabase()
      .from('subscriptions')
      .upsert({
        merchant_id: merchantId,
        plan_id: planId,
        billing_provider: 'paypal',
        provider_subscription_id: subscription.id,
        provider_customer_id: subscription.subscriber.payer_id,
        status,
        current_period_start: subscription.start_time 
          ? new Date(subscription.start_time).toISOString() 
          : new Date().toISOString(),
        current_period_end: subscription.billing_info?.next_billing_time
          ? new Date(subscription.billing_info.next_billing_time).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'merchant_id',
      });

    // Log billing event
    await requireSupabase().from('billing_events').insert({
      event_type: 'paypal.subscription.confirmed',
      provider: 'paypal',
      provider_event_id: subscription.id,
      merchant_id: merchantId,
      payload: subscription,
      processed: true,
    });

    res.json({
      success: true,
      status: subscription.status,
    });
  } catch (error) {
    console.error('Error confirming PayPal subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to confirm PayPal subscription' });
  }
});

/**
 * POST /api/billing/paypal/cancel
 * Cancels a PayPal subscription
 */
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { merchantId, reason } = z.object({
      merchantId: z.string().uuid(),
      reason: z.string().optional(),
    }).parse(req.body);

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('provider_subscription_id')
      .eq('merchant_id', merchantId)
      .eq('billing_provider', 'paypal')
      .single();

    if (error || !subscription?.provider_subscription_id) {
      return res.status(404).json({
        error: 'PayPal subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND',
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Cancel subscription in PayPal
    const cancelResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscription.provider_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Customer requested cancellation',
        }),
      }
    );

    if (!cancelResponse.ok && cancelResponse.status !== 204) {
      const errorData = await cancelResponse.json();
      console.error('PayPal cancellation failed:', errorData);
      return res.status(500).json({
        error: 'Failed to cancel PayPal subscription',
        details: errorData,
      });
    }

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      message: 'Subscription cancelled',
    });
  } catch (error) {
    console.error('Error cancelling PayPal subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to cancel PayPal subscription' });
  }
});

/**
 * POST /api/billing/paypal/suspend
 * Suspends (pauses) a PayPal subscription
 */
router.post('/suspend', async (req: Request, res: Response) => {
  try {
    const { merchantId, reason } = z.object({
      merchantId: z.string().uuid(),
      reason: z.string().optional(),
    }).parse(req.body);

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('provider_subscription_id')
      .eq('merchant_id', merchantId)
      .eq('billing_provider', 'paypal')
      .single();

    if (error || !subscription?.provider_subscription_id) {
      return res.status(404).json({
        error: 'PayPal subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND',
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Suspend subscription in PayPal
    const suspendResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscription.provider_subscription_id}/suspend`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Customer requested pause',
        }),
      }
    );

    if (!suspendResponse.ok && suspendResponse.status !== 204) {
      const errorData = await suspendResponse.json();
      console.error('PayPal suspension failed:', errorData);
      return res.status(500).json({
        error: 'Failed to suspend PayPal subscription',
        details: errorData,
      });
    }

    // Update local record
    await requireSupabase()
      .from('subscriptions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId);

    res.json({
      success: true,
      message: 'Subscription paused',
    });
  } catch (error) {
    console.error('Error suspending PayPal subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to suspend PayPal subscription' });
  }
});

/**
 * POST /api/billing/paypal/activate
 * Reactivates a suspended PayPal subscription
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const { merchantId, reason } = z.object({
      merchantId: z.string().uuid(),
      reason: z.string().optional(),
    }).parse(req.body);

    // Get subscription
    const { data: subscription, error } = await requireSupabase()
      .from('subscriptions')
      .select('provider_subscription_id')
      .eq('merchant_id', merchantId)
      .eq('billing_provider', 'paypal')
      .single();

    if (error || !subscription?.provider_subscription_id) {
      return res.status(404).json({
        error: 'PayPal subscription not found',
        code: 'SUBSCRIPTION_NOT_FOUND',
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Activate subscription in PayPal
    const activateResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscription.provider_subscription_id}/activate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Customer requested reactivation',
        }),
      }
    );

    if (!activateResponse.ok && activateResponse.status !== 204) {
      const errorData = await activateResponse.json();
      console.error('PayPal activation failed:', errorData);
      return res.status(500).json({
        error: 'Failed to activate PayPal subscription',
        details: errorData,
      });
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
      message: 'Subscription reactivated',
    });
  } catch (error) {
    console.error('Error activating PayPal subscription:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to activate PayPal subscription' });
  }
});

export default router;
