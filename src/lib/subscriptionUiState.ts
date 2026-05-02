import type { Tables } from '@/integrations/supabase/types';

type Subscription = Tables<'subscriptions'>;

export type SubscriptionUiKind =
  | 'trial_active'
  | 'trial_expiring'
  | 'active'
  | 'expiring'
  | 'expired';

export type ExpiringReason = 'payment_failed' | 'paused' | 'scheduled_cancel' | 'generic';

/** Inputs mirror flags from `useSubscription` — keep this list in sync when the hook changes. */
export interface SubscriptionUiInput {
  loading: boolean;
  subscription: Subscription | null;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isPaused: boolean;
  isCanceled: boolean;
  isCanceledTrial: boolean;
  isInTrialWindow: boolean;
  isSubscriptionCancelingAtPeriodEnd: boolean;
  cancelAtPeriodEndEffectiveDate: string | null;
  hasActivePaymentMethod: boolean;
  hasStripeSubscription: boolean;
  trialNeedsResubscribe: boolean;
  canAccessFeatures: boolean;
  requiresPayment: boolean;
}

export type SubscriptionDateContext = 'trial_end' | 'period_end' | null;

export interface SubscriptionUiModel {
  kind: SubscriptionUiKind;
  pillLabel: string;
  pillClassName: string;
  showBanner: boolean;
  bannerTone: 'amber' | 'red';
  /** Stable line for analytics/tests; banner may prepend a formatted date from `dateIso`. */
  bannerMessage: string;
  /** Optional ISO timestamp for trial end, period end, or scheduled cancellation. */
  dateIso: string | null;
  /** How to label `dateIso` when showing the banner (ignored when `showBanner` is false). */
  dateContext: SubscriptionDateContext;
  expiringReason: ExpiringReason | null;
}

const PILL_GREEN =
  'border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50';

const PILL_AMBER =
  'border-transparent bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30';

const PILL_RED =
  'border-transparent bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50';

function expiredModel(message: string): SubscriptionUiModel {
  return {
    kind: 'expired',
    pillLabel: 'Expired',
    pillClassName: PILL_RED,
    showBanner: true,
    bannerTone: 'red',
    bannerMessage: message,
    dateIso: null,
    dateContext: null,
    expiringReason: null,
  };
}

function expiringModel(reason: ExpiringReason, dateIso: string | null): SubscriptionUiModel {
  const messages: Record<ExpiringReason, string> = {
    payment_failed: 'Payment failed or billing needs attention. Update your payment method to avoid losing access.',
    paused: 'Your subscription is paused. Resume or update billing to restore service.',
    scheduled_cancel:
      'Your subscription is set to end after this billing period. You can update billing or reactivate before then.',
    generic: 'Your subscription needs attention before the next renewal.',
  };

  return {
    kind: 'expiring',
    pillLabel: 'Expiring',
    pillClassName: PILL_AMBER,
    showBanner: true,
    bannerTone: 'amber',
    bannerMessage: messages[reason],
    dateIso,
    dateContext: dateIso ? 'period_end' : null,
    expiringReason: reason,
  };
}

/**
 * Derives banner + pill state from subscription flags. Returns null while loading.
 * Precedence: trial window → payment/pause issues → scheduled cancellation → healthy active → terminal states.
 */
export function computeSubscriptionUiState(input: SubscriptionUiInput): SubscriptionUiModel | null {
  if (input.loading) {
    return null;
  }

  const s = input.subscription;
  if (!s) {
    return expiredModel('No active subscription. Subscribe to continue.');
  }

  const cancelAtEnd = !!s.cancel_at_period_end;
  const status = s.status ?? 'incomplete';

  // --- Calendar trial window
  if (input.isInTrialWindow) {
    const healthyTrial =
      input.hasActivePaymentMethod
      && !input.trialNeedsResubscribe
      && !cancelAtEnd
      && input.hasStripeSubscription
      && (status === 'trialing' || status === 'active');

    if (healthyTrial) {
      return {
        kind: 'trial_active',
        pillLabel: 'Trial Active',
        pillClassName: PILL_GREEN,
        showBanner: false,
        bannerTone: 'amber',
        bannerMessage: '',
        dateIso: s.trial_end || null,
        dateContext: null,
        expiringReason: null,
      };
    }

    return {
      kind: 'trial_expiring',
      pillLabel: 'Trial Expiring',
      pillClassName: PILL_AMBER,
      showBanner: true,
      bannerTone: 'amber',
      bannerMessage:
        'Add or fix payment in Stripe before the trial ends so your subscription can continue.',
      dateIso: s.trial_end || null,
      dateContext: s.trial_end ? 'trial_end' : null,
      expiringReason: null,
    };
  }

  // --- Paid / post-trial: collection or renewal risk
  if (input.isPastDue) {
    const dateIso = s.current_period_end || s.trial_end || null;
    return expiringModel('payment_failed', dateIso);
  }

  if (input.isPaused) {
    const dateIso = s.current_period_end || s.trial_end || null;
    return expiringModel('paused', dateIso);
  }

  if (input.isSubscriptionCancelingAtPeriodEnd && (status === 'active' || status === 'trialing')) {
    const dateIso =
      input.cancelAtPeriodEndEffectiveDate || s.current_period_end || s.trial_end || null;
    return expiringModel('scheduled_cancel', dateIso);
  }

  // Healthy paid subscription (not in calendar trial window)
  if (
    status === 'active'
    && input.hasActivePaymentMethod
    && !cancelAtEnd
    && !input.isPastDue
    && !input.isPaused
  ) {
    return {
      kind: 'active',
      pillLabel: 'Active',
      pillClassName: PILL_GREEN,
      showBanner: false,
      bannerTone: 'amber',
      bannerMessage: '',
      dateIso: s.current_period_end || null,
      dateContext: null,
      expiringReason: null,
    };
  }

  // Explicitly ended in Stripe / Supabase
  if ((input.isCanceled && !input.isCanceledTrial) || status === 'incomplete') {
    return expiredModel('Your subscription has ended. Resubscribe to continue.');
  }

  // Locked out or billing required
  if (!input.canAccessFeatures && input.requiresPayment) {
    return expiredModel('Your subscription has ended or billing is required to continue.');
  }

  const fallbackDate = s.current_period_end || s.trial_end || null;
  return expiringModel('generic', fallbackDate);
}

export function subscriptionUiInputFromSubscriptionData(data: {
  loading: boolean;
  subscription: Subscription | null;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isPaused: boolean;
  isCanceled: boolean;
  isCanceledTrial: boolean;
  isInTrialWindow: boolean;
  isSubscriptionCancelingAtPeriodEnd: boolean;
  cancelAtPeriodEndEffectiveDate: string | null;
  hasActivePaymentMethod: boolean;
  hasStripeSubscription: boolean;
  trialNeedsResubscribe: boolean;
  canAccessFeatures: boolean;
  requiresPayment: boolean;
}): SubscriptionUiInput {
  return {
    loading: data.loading,
    subscription: data.subscription,
    isTrialing: data.isTrialing,
    isActive: data.isActive,
    isPastDue: data.isPastDue,
    isPaused: data.isPaused,
    isCanceled: data.isCanceled,
    isCanceledTrial: data.isCanceledTrial,
    isInTrialWindow: data.isInTrialWindow,
    isSubscriptionCancelingAtPeriodEnd: data.isSubscriptionCancelingAtPeriodEnd,
    cancelAtPeriodEndEffectiveDate: data.cancelAtPeriodEndEffectiveDate,
    hasActivePaymentMethod: data.hasActivePaymentMethod,
    hasStripeSubscription: data.hasStripeSubscription,
    trialNeedsResubscribe: data.trialNeedsResubscribe,
    canAccessFeatures: data.canAccessFeatures,
    requiresPayment: data.requiresPayment,
  };
}
