import { useState, useEffect, useCallback } from 'react';
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
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isPaused: boolean;
  isCanceled: boolean;
  trialStatus: TrialStatus | null;
  smsUsage: SmsUsage;
  seatUsage: SeatUsage;
  requiresPayment: boolean;
  canAccessFeatures: boolean;
}

interface UseSubscriptionResult extends SubscriptionData {
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createTrialSubscription: () => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook for managing merchant subscription state.
 * Handles subscription data fetching, trial status, and usage tracking.
 */
export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  
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
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
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

        // Check trial status
        if (subData.status === 'trialing') {
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
          }
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
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', user.id)
          .eq('billable', true);

        const staffIncluded = planData?.staff_included || 1;
        const maxStaff = planData?.max_staff || null;
        const isUnlimitedStaff = planData?.is_unlimited_staff || false;
        const seatsTotal = subData.seats_count || 1;
        const staffUsed = activeStaff || 1;

        setSeatUsage({
          used: staffUsed,
          included: staffIncluded,
          additional: Math.max(0, seatsTotal - staffIncluded),
          total: seatsTotal,
          canAdd: isUnlimitedStaff || maxStaff === null || staffUsed < maxStaff,
        });
      } else {
        // No subscription found
        setSubscription(null);
        setPlan(null);
        setTrialStatus(null);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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

  // Computed values
  const status = subscription?.status || 'none';
  const isTrialing = status === 'trialing';
  const isActive = status === 'active';
  const isPastDue = status === 'past_due';
  const isPaused = status === 'paused';
  const isCanceled = status === 'canceled';
  
  // User needs payment if trial ended or in certain states
  const requiresPayment = 
    (isTrialing && !subscription?.billing_provider) ||
    isPastDue ||
    (!subscription && !loading);
  
  // User can access features if trialing, active, or has grace period
  const canAccessFeatures = isTrialing || isActive || (isPastDue && subscription !== null);

  return {
    subscription,
    plan,
    isTrialing,
    isActive,
    isPastDue,
    isPaused,
    isCanceled,
    trialStatus,
    smsUsage,
    seatUsage,
    requiresPayment,
    canAccessFeatures,
    loading,
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
export function useBillingPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const openPortal = useCallback(async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: user.id,
          returnUrl: `${window.location.origin}/merchant/settings`,
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



