import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMerchantProfile } from './useMerchantProfile';
import type { Tables } from '@/integrations/supabase/types';

type Plan = Tables<'plans'>;
type Subscription = Tables<'subscriptions'>;

interface TrialStatus {
  shouldEnd: boolean;
  reason: string | null;
  openingsFilled: number;
  daysRemaining: number;
}

interface SmsUsage {
  used: number;
  included: number | 'unlimited';
  overage: number;
  overageCost: number;
}

interface SeatUsage {
  used: number;
  included: number;
  additional: number;
  total: number;
  canAdd: boolean;
}

export interface SubscriptionData {
  subscription: Subscription | null;
  plan: Plan | null;
  subscriptionMissing: boolean | null;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isPaused: boolean;
  isCanceled: boolean;
  isCanceledImmediate: boolean;
  isCanceledTrial: boolean;
  isInTrialWindow: boolean;
  trialExpired: boolean;
  hasActivePaymentMethod: boolean;
  hasStripeSubscription: boolean;
  isStripeSubscriptionActive: boolean;
  trialNeedsResubscribe: boolean;
  suppressBillingBanner: boolean;
  trialStatus: TrialStatus | null;
  smsUsage: SmsUsage;
  seatUsage: SeatUsage;
  requiresPayment: boolean;
  canAccessFeatures: boolean;
}

interface UseSubscriptionResult extends SubscriptionData {
  loading: boolean;
  error: Error | null;
  refetch: (options?: { silent?: boolean }) => Promise<void>;
  createTrialSubscription: () => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PORTAL_RETURN_KEY = 'billing_portal_return_at';
const PORTAL_RETURN_WINDOW_MS = 2 * 60 * 1000;
const PORTAL_RETURN_PARAM = 'billing';
const PORTAL_RETURN_VALUE = 'portal_return';

/**
 * Hook for managing merchant subscription state.
 * Handles subscription data fetching, trial status, and usage tracking.
 */
export function useSubscription(): UseSubscriptionResult {
  const { user, loading: authLoading } = useAuth();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [smsUsage, setSmsUsage] = useState<SmsUsage>({
    used: 0,
    included: 300,
    overage: 0,
    overageCost: 0,
  });
  const [seatUsage, setSeatUsage] = useState<SeatUsage>({
    used: 1,
    included: 1,
    additional: 0,
    total: 1,
    canAdd: true,
  });
  const [loading, setLoading] = useState(true);
  const [subscriptionMissing, setSubscriptionMissing] = useState<boolean | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const trialCreationAttempted = useRef(false);
  const lastFetchAt = useRef(0);
  const fetchInFlight = useRef(false);
  const [suppressBillingBanner, setSuppressBillingBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    const url = new URL(window.location.href);
    if (url.searchParams.get(PORTAL_RETURN_PARAM) === PORTAL_RETURN_VALUE) {
      window.localStorage.setItem(PORTAL_RETURN_KEY, Date.now().toString());
      return true;
    }
    const ts = Number(window.localStorage.getItem(PORTAL_RETURN_KEY));
    return Number.isFinite(ts) && Date.now() - ts < PORTAL_RETURN_WINDOW_MS;
  });

  const fetchSubscription = useCallback(async (options?: { silent?: boolean }) => {
    if (authLoading) {
      return;
    }

    if (!user?.id) {
      setLoading(false);
      setHasFetched(true);
      return;
    }

    try {
      if (fetchInFlight.current) return;
      fetchInFlight.current = true;

      const shouldShowLoading = !options?.silent || !subscription;
      if (shouldShowLoading) {
        setLoading(true);
      }
      setError(null);

      // Fetch subscription with plan details
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('merchant_id', user.id)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        // PGRST116 = no rows found (expected for new users)
        throw subError;
      }

      if (subData) {
        setSubscription(subData);
        setPlan(subData.plans as Plan);
        setSubscriptionMissing(false);

        // Check trial status when trial data exists (used for gating and messaging)
        if (subData.trial_end) {
          const { data: trialData } = await supabase.rpc('check_trial_status', {
            p_merchant_id: user.id,
          });

          if (trialData && trialData.length > 0) {
            setTrialStatus({
              shouldEnd: trialData[0].should_end,
              reason: trialData[0].reason,
              openingsFilled: trialData[0].openings_filled,
              daysRemaining: trialData[0].days_remaining,
            });
          } else {
            setTrialStatus(null);
          }
        } else {
          setTrialStatus(null);
        }

        // Get SMS usage
        const { data: smsData } = await supabase.rpc('get_current_sms_usage', {
          p_subscription_id: subData.id,
        });

        const planData = subData.plans as Plan;
        const smsIncluded = planData?.sms_included || 300;
        const isUnlimitedSms = planData?.is_unlimited_sms || false;
        const currentSmsUsage = smsData || 0;
        const smsOverage = isUnlimitedSms ? 0 : Math.max(0, currentSmsUsage - smsIncluded);

        setSmsUsage({
          used: currentSmsUsage,
          included: isUnlimitedSms ? 'unlimited' : smsIncluded,
          overage: smsOverage,
          overageCost: smsOverage > 0 
            ? Math.ceil(smsOverage / 100) * ((planData?.sms_overage_price_per_100 || 200) / 100)
            : 0,
        });

        // Get seat usage
        const { count: activeStaff } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: false })
          .eq('merchant_id', user.id)
          .eq('active', true);

        const staffIncluded = planData?.staff_included || 1;
        const seatsTotal = subData.seats_count || 1;
        const staffUsed = activeStaff ?? 0;

        setSeatUsage({
          used: staffUsed,
          included: staffIncluded,
          additional: Math.max(0, seatsTotal - staffIncluded),
          total: seatsTotal,
          canAdd: staffUsed < seatsTotal,
        });
      } else {
        // No subscription found
        setSubscription(null);
        setPlan(null);
        setTrialStatus(null);
        if (subError?.code === 'PGRST116') {
          setSubscriptionMissing(true);
        }
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err as Error);
    } finally {
      lastFetchAt.current = Date.now();
      fetchInFlight.current = false;
      setHasFetched(true);
      setLoading(false);
    }
  }, [authLoading, user?.id, subscription]);

  // Create trial subscription for new merchants
  const createTrialSubscription = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get default plan (Starter)
      const { data: starterPlan } = await supabase
        .from('plans')
        .select('id')
        .eq('id', 'starter')
        .single();

      if (!starterPlan) {
        throw new Error('Starter plan not found');
      }

      // Calculate trial end (30 days from now)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      // Create subscription
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          merchant_id: user.id,
          plan_id: 'starter',
          status: 'trialing',
          trial_start: new Date().toISOString(),
          trial_end: trialEnd.toISOString(),
          openings_filled_during_trial: 0,
          seats_count: 1,
        });

      if (insertError) {
        throw insertError;
      }

      // Refetch to get the new subscription
      await fetchSubscription();
    } catch (err) {
      console.error('Error creating trial subscription:', err);
      setError(err as Error);
    }
  }, [user?.id, fetchSubscription]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (typeof window !== 'undefined') {
        const ts = Number(window.localStorage.getItem(PORTAL_RETURN_KEY));
        if (Number.isFinite(ts) && Date.now() - ts < PORTAL_RETURN_WINDOW_MS) {
          fetchSubscription({ silent: true });
          return;
        }
      }
      if (loading) return;
      if (Date.now() - lastFetchAt.current < 10_000) return;
      fetchSubscription({ silent: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfStale();
      }
    };

    const handleFocus = () => {
      refreshIfStale();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshIfStale();
      }
    }, 60_000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, [fetchSubscription, loading]);

  useEffect(() => {
    if (
      authLoading
      || loading
      || subscription
      || subscriptionMissing === null
      || subscriptionMissing === false
      || !user?.id
      || trialCreationAttempted.current
    ) {
      return;
    }

    trialCreationAttempted.current = true;
    createTrialSubscription();
  }, [authLoading, loading, subscription, subscriptionMissing, user?.id, createTrialSubscription]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ts = Number(window.localStorage.getItem(PORTAL_RETURN_KEY));
    if (!Number.isFinite(ts)) {
      setSuppressBillingBanner(false);
      return;
    }

    const updatedAt = subscription?.updated_at
      ? new Date(subscription.updated_at).getTime()
      : null;
    const elapsed = Date.now() - ts;

    if (updatedAt && updatedAt >= ts) {
      window.localStorage.removeItem(PORTAL_RETURN_KEY);
      setSuppressBillingBanner(false);
      return;
    }

    if (elapsed >= PORTAL_RETURN_WINDOW_MS) {
      window.localStorage.removeItem(PORTAL_RETURN_KEY);
      setSuppressBillingBanner(false);
      return;
    }

    setSuppressBillingBanner(true);
    const remaining = PORTAL_RETURN_WINDOW_MS - elapsed;
    const timer = window.setTimeout(() => {
      window.localStorage.removeItem(PORTAL_RETURN_KEY);
      setSuppressBillingBanner(false);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [subscription?.updated_at]);

  // Computed values
  const status = subscription?.status || 'none';
  const trialExpiredByDate = subscription?.trial_end
    ? new Date(subscription.trial_end).getTime() <= Date.now()
    : false;
  const trialExpired = (trialStatus?.shouldEnd === true) || trialExpiredByDate;
  const isCanceledImmediate = status === 'canceled'
    && !!subscription?.canceled_at
    && !subscription?.cancel_at_period_end;
  const isInTrialWindow = !!subscription?.trial_end && !trialExpired && !isCanceledImmediate;
  const isTrialing = status === 'trialing' || (status === 'active' && isInTrialWindow);
  const isActive = status === 'active';
  const isPastDue = status === 'past_due';
  const isPaused = status === 'paused';
  const isCanceled = status === 'canceled' || status === 'incomplete';
  const isCanceledTrial = isCanceled && isInTrialWindow;
  const hasStripeSubscription = subscription?.billing_provider === 'stripe'
    && !!subscription?.provider_subscription_id;
  const isStripeSubscriptionActive = hasStripeSubscription
    && (status === 'trialing' || status === 'active');
  const trialNeedsResubscribe = isInTrialWindow
    && (!hasStripeSubscription || status === 'canceled' || status === 'incomplete');
  const hasActivePaymentMethod = hasStripeSubscription
    && !isCanceled
    && !(subscription?.cancel_at_period_end && isInTrialWindow);

  // User needs payment if subscription is inactive or trial has ended
  const requiresPayment = 
    isPastDue ||
    isPaused ||
    (isCanceled && !isInTrialWindow) ||
    (trialExpired && !hasActivePaymentMethod) ||
    (!subscription && !loading);
  
  // User can access features if active or in a valid trial window
  const canAccessFeatures = isActive || (isTrialing && !trialExpired) || isCanceledTrial;

  const resolvedLoading = loading || !hasFetched;

  return {
    subscription,
    plan,
    subscriptionMissing,
    isTrialing,
    isActive,
    isPastDue,
    isPaused,
    isCanceled,
    isCanceledImmediate,
    isCanceledTrial,
    isInTrialWindow,
    trialExpired,
    hasActivePaymentMethod,
    hasStripeSubscription,
    isStripeSubscriptionActive,
    trialNeedsResubscribe,
    suppressBillingBanner,
    trialStatus,
    smsUsage,
    seatUsage,
    requiresPayment,
    canAccessFeatures,
    loading: resolvedLoading,
    error,
    refetch: fetchSubscription,
    createTrialSubscription,
  };
}

/**
 * Hook for creating Stripe checkout session
 */
interface CheckoutOptions {
  successUrl?: string;
  cancelUrl?: string;
  seatsCount?: number;
  billingCadence?: 'monthly' | 'annual';
}

export function useStripeCheckout() {
  const { user } = useAuth();
  const { profile: merchantProfile } = useMerchantProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createCheckout = useCallback(async (
    planId: 'starter' | 'pro',
    emailOverride?: string,
    options?: CheckoutOptions
  ) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const email = (emailOverride || merchantProfile?.email || '').trim();
    if (!email) {
      throw new Error('Email is required to start checkout');
    }

    setLoading(true);
    setError(null);

    try {
      window.localStorage.setItem(PORTAL_RETURN_KEY, Date.now().toString());
      const successUrl = options?.successUrl || `${window.location.origin}/merchant/settings?billing=success`;
      const cancelUrl = options?.cancelUrl || `${window.location.origin}/merchant/settings?billing=canceled`;

      const response = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: user.id,
          planId,
          successUrl,
          cancelUrl,
          email,
          seatsCount: options?.seatsCount,
          billingCadence: options?.billingCadence,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, merchantProfile?.email]);

  return { createCheckout, loading, error };
}

/**
 * Hook for opening Stripe Billing Portal
 */
interface BillingPortalOptions {
  returnUrl?: string;
}

export function useBillingPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const openPortal = useCallback(async (options?: BillingPortalOptions) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      window.localStorage.setItem(PORTAL_RETURN_KEY, Date.now().toString());
      const returnUrl = options?.returnUrl || `${window.location.origin}/merchant/settings`;
      const resolvedReturnUrl = new URL(returnUrl, window.location.origin);
      resolvedReturnUrl.searchParams.set(PORTAL_RETURN_PARAM, PORTAL_RETURN_VALUE);
      const response = await fetch(`${API_URL}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: user.id,
          returnUrl: resolvedReturnUrl.toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Portal
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Error opening billing portal:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return { openPortal, loading, error };
}

export default useSubscription;
