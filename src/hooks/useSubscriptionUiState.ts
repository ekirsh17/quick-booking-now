import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  computeSubscriptionUiState,
  subscriptionUiInputFromSubscriptionData,
  type SubscriptionUiModel,
} from '@/lib/subscriptionUiState';
import { useSubscription } from './useSubscription';

export type BannerPrimaryAction = 'portal' | 'checkout';

export interface UseSubscriptionUiStateResult extends ReturnType<typeof useSubscription> {
  ui: SubscriptionUiModel | null;
  /** Formatted date for banner copy when `ui.dateIso` is set. */
  formattedBannerDate: string | null;
  /** Stripe Customer Billing Portal vs new Checkout session. */
  bannerPrimaryAction: BannerPrimaryAction;
}

/**
 * Single subscription snapshot for UI: pill + layout banner share `ui`.
 */
export function useSubscriptionUiState(): UseSubscriptionUiStateResult {
  const subscriptionData = useSubscription();

  const ui = useMemo(() => {
    return computeSubscriptionUiState(
      subscriptionUiInputFromSubscriptionData({
        loading: subscriptionData.loading,
        subscription: subscriptionData.subscription,
        isTrialing: subscriptionData.isTrialing,
        isActive: subscriptionData.isActive,
        isPastDue: subscriptionData.isPastDue,
        isPaused: subscriptionData.isPaused,
        isCanceled: subscriptionData.isCanceled,
        isCanceledTrial: subscriptionData.isCanceledTrial,
        isInTrialWindow: subscriptionData.isInTrialWindow,
        isSubscriptionCancelingAtPeriodEnd: subscriptionData.isSubscriptionCancelingAtPeriodEnd,
        cancelAtPeriodEndEffectiveDate: subscriptionData.cancelAtPeriodEndEffectiveDate,
        hasActivePaymentMethod: subscriptionData.hasActivePaymentMethod,
        hasStripeSubscription: subscriptionData.hasStripeSubscription,
        trialNeedsResubscribe: subscriptionData.trialNeedsResubscribe,
        canAccessFeatures: subscriptionData.canAccessFeatures,
        requiresPayment: subscriptionData.requiresPayment,
      }),
    );
  }, [
    subscriptionData.loading,
    subscriptionData.subscription,
    subscriptionData.isTrialing,
    subscriptionData.isActive,
    subscriptionData.isPastDue,
    subscriptionData.isPaused,
    subscriptionData.isCanceled,
    subscriptionData.isCanceledTrial,
    subscriptionData.isInTrialWindow,
    subscriptionData.isSubscriptionCancelingAtPeriodEnd,
    subscriptionData.cancelAtPeriodEndEffectiveDate,
    subscriptionData.hasActivePaymentMethod,
    subscriptionData.hasStripeSubscription,
    subscriptionData.trialNeedsResubscribe,
    subscriptionData.canAccessFeatures,
    subscriptionData.requiresPayment,
  ]);

  const formattedBannerDate = useMemo(() => {
    if (!ui?.dateIso) return null;
    try {
      return format(new Date(ui.dateIso), 'MMMM d, yyyy');
    } catch {
      return null;
    }
  }, [ui?.dateIso]);

  const bannerPrimaryAction = useMemo((): BannerPrimaryAction => {
    if (!subscriptionData.subscription) return 'checkout';
    if (subscriptionData.trialNeedsResubscribe) return 'checkout';
    if (subscriptionData.subscription.billing_provider !== 'stripe') return 'checkout';
    if (ui?.kind === 'expired') return 'checkout';
    return 'portal';
  }, [
    subscriptionData.subscription,
    subscriptionData.trialNeedsResubscribe,
    ui?.kind,
  ]);

  return {
    ...subscriptionData,
    ui,
    formattedBannerDate,
    bannerPrimaryAction,
  };
}
