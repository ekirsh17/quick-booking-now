import { useMemo } from 'react';
import { useSubscription, SubscriptionData } from './useSubscription';

export interface Entitlements {
  /** Can create new openings */
  canCreateOpenings: boolean;
  /** Can add staff members */
  canAddStaff: boolean;
  /** Can send SMS notifications */
  canSendSMS: boolean;
  /** Has an active or trialing subscription */
  isSubscribed: boolean;
  /** Needs to provide payment (trial ended, past due, etc) */
  requiresPayment: boolean;
  /** Is in trial period */
  isTrialing: boolean;
  /** Has paid subscription */
  isPaid: boolean;
  /** Subscription canceled but still within trial window */
  isCanceledTrial: boolean;
  /** Reason for blocking if any */
  blockReason: string | null;
  /** Days remaining in trial */
  trialDaysRemaining: number | null;
  /** Openings filled during trial */
  trialOpeningsFilled: number | null;
  /** Maximum openings in trial (2) */
  trialOpeningsMax: number;
  /** Trial end date (ISO) */
  trialEndsAt: string | null;
  /** Trial is active but missing payment method */
  trialNeedsPaymentMethod: boolean;
  /** Trial is active but needs resubscribe in Stripe */
  trialNeedsResubscribe: boolean;
  /** Trial has ended based on status check */
  trialExpired: boolean;
  /** Has unlimited SMS */
  hasUnlimitedSMS: boolean;
  /** Has unlimited staff */
  hasUnlimitedStaff: boolean;
  /** SMS remaining (before overage) */
  smsRemaining: number | 'unlimited';
  /** Seats remaining */
  seatsRemaining: number | 'unlimited';
}

interface UseEntitlementsResult extends Entitlements {
  /** Subscription data from useSubscription */
  subscriptionData: SubscriptionData;
  /** Whether entitlements are still loading */
  loading: boolean;
}

/**
 * Hook for checking user entitlements based on subscription status.
 * Use this to gate features throughout the app.
 */
export function useEntitlements(): UseEntitlementsResult {
  const subscriptionData = useSubscription();
  
  const {
    subscription,
    plan,
    isTrialing,
    isActive,
    isPastDue,
    isCanceled,
    isCanceledTrial,
    trialExpired,
    trialNeedsResubscribe,
    trialStatus,
    smsUsage,
    seatUsage,
    requiresPayment,
    canAccessFeatures,
    hasActivePaymentMethod,
    loading,
  } = subscriptionData;

  const entitlements = useMemo((): Entitlements => {
    // Default values when no subscription
    if (!subscription) {
      return {
        canCreateOpenings: false,
        canAddStaff: false,
        canSendSMS: false,
        isSubscribed: false,
        requiresPayment: true,
        isTrialing: false,
        isPaid: false,
        blockReason: 'No active subscription, and your trial has ended. Subscribe to continue using OpenAlert.',
        trialDaysRemaining: null,
        trialOpeningsFilled: null,
        trialOpeningsMax: 2,
        trialEndsAt: null,
        trialNeedsPaymentMethod: false,
        trialNeedsResubscribe: false,
        trialExpired: true,
        hasUnlimitedSMS: false,
        hasUnlimitedStaff: false,
        smsRemaining: 0,
        seatsRemaining: 0,
      };
    }

    const isPaid = isActive && hasActivePaymentMethod;
    const hasUnlimitedSMS = plan?.is_unlimited_sms || false;
    const hasUnlimitedStaff = plan?.is_unlimited_staff || false;
    const trialNeedsPaymentMethod = isTrialing && !hasActivePaymentMethod && !trialNeedsResubscribe;
    
    // Calculate remaining SMS
    const smsIncluded = plan?.sms_included || 300;
    const smsUsed = smsUsage.used;
    const smsRemaining = hasUnlimitedSMS 
      ? 'unlimited' as const
      : Math.max(0, smsIncluded - smsUsed);
    
    // Calculate remaining seats
    const maxStaff = plan?.max_staff || null;
    const seatsUsed = seatUsage.used;
    const seatsRemaining = hasUnlimitedStaff || maxStaff === null
      ? 'unlimited' as const
      : Math.max(0, (subscription.seats_count || 1) - seatsUsed);

    // Determine block reason
    let blockReason: string | null = null;
    
    if (isCanceled && !isTrialing && !isCanceledTrial) {
      blockReason = 'Your subscription has been canceled. Please resubscribe to continue.';
    } else if (isPastDue) {
      blockReason = 'Payment failed. Please update your payment method to continue.';
    } else if (trialExpired && !hasActivePaymentMethod) {
      if (trialStatus?.reason === 'openings_filled') {
        blockReason = `You've filled ${trialStatus.openingsFilled} openings! Add payment to continue growing your business.`;
      } else {
        blockReason = 'No active subscription, and your trial has ended. Subscribe to continue using OpenAlert.';
      }
    } else if (!isActive && !isTrialing) {
      blockReason = 'No active subscription. Please subscribe to continue.';
    }

    // Calculate entitlements
    const canCreateOpenings = canAccessFeatures && !blockReason;
    const canAddStaff = canCreateOpenings && seatUsage.canAdd;
    const canSendSMS = canCreateOpenings && (hasUnlimitedSMS || smsRemaining === 'unlimited' || smsRemaining > 0);

    return {
      canCreateOpenings,
      canAddStaff,
      canSendSMS,
      isSubscribed: isTrialing || isActive || isCanceledTrial,
      requiresPayment,
      isTrialing,
      isPaid,
      blockReason,
      isCanceledTrial,
      trialDaysRemaining: trialStatus?.daysRemaining ?? null,
      trialOpeningsFilled: trialStatus?.openingsFilled ?? null,
      trialOpeningsMax: 2,
      trialEndsAt: subscription.trial_end || null,
      trialNeedsPaymentMethod,
      trialNeedsResubscribe,
      trialExpired,
      hasUnlimitedSMS,
      hasUnlimitedStaff,
      smsRemaining,
      seatsRemaining,
    };
  }, [
    subscription,
    plan,
    isTrialing,
    isActive,
    isPastDue,
    isCanceled,
    isCanceledTrial,
    trialExpired,
    trialStatus,
    smsUsage,
    seatUsage,
    requiresPayment,
    canAccessFeatures,
    hasActivePaymentMethod,
    trialNeedsResubscribe,
  ]);

  return {
    ...entitlements,
    subscriptionData,
    loading,
  };
}

/**
 * Hook specifically for checking if a feature is available.
 * Returns a simpler interface for quick checks.
 */
export function useFeatureGate(feature: 'openings' | 'staff' | 'sms') {
  const entitlements = useEntitlements();
  
  const isAllowed = useMemo(() => {
    switch (feature) {
      case 'openings':
        return entitlements.canCreateOpenings;
      case 'staff':
        return entitlements.canAddStaff;
      case 'sms':
        return entitlements.canSendSMS;
      default:
        return false;
    }
  }, [feature, entitlements]);

  return {
    isAllowed,
    blockReason: isAllowed ? null : entitlements.blockReason,
    loading: entitlements.loading,
    requiresPayment: entitlements.requiresPayment,
  };
}

export default useEntitlements;
