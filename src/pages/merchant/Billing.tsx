import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useSubscription, 
  useStripeCheckout,
  useBillingPortal 
} from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useReportingMetrics } from '@/hooks/useReportingMetrics';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { SavingsSummary } from '@/components/billing/SavingsSummary';
import { SeatManagement } from '@/components/billing/SeatManagement';

export function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const billingStatus = searchParams.get('billing');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const reconcileCooldownRef = useRef(0);
  const handledBillingStatus = useRef<string | null>(null);
  const [shouldPollPortalReturn, setShouldPollPortalReturn] = useState(false);
  const { user } = useAuth();
  
  const {
    subscription,
    plan,
    isTrialing,
    isCanceledTrial,
    isInTrialWindow,
    trialExpired,
    trialStatus,
    seatUsage,
    hasActivePaymentMethod,
    hasStripeSubscription,
    trialNeedsResubscribe,
    loading: subscriptionLoading,
    refetch,
  } = useSubscription();

  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();
  const { openPortal, loading: portalLoading } = useBillingPortal();
  const { metrics } = useReportingMetrics();
  const didInitialRefetch = useRef(false);

  const reconcileSubscription = useCallback(async (options?: { force?: boolean }) => {
    const merchantId = user?.id || subscription?.merchant_id;
    if (!merchantId) return;
    const now = Date.now();
    const cooldownMs = 60_000;
    if (!options?.force && now - reconcileCooldownRef.current < cooldownMs) return;
    reconcileCooldownRef.current = now;

    try {
      await fetch(`${API_URL}/api/billing/reconcile-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchantId }),
      });
    } catch {
      // Avoid blocking UI on reconcile failures; webhook/refresh will still update.
    }
  }, [API_URL, subscription?.merchant_id, user?.id]);

  // Handle billing success/error from redirect
  useEffect(() => {
    if (!billingStatus || handledBillingStatus.current === billingStatus) return;
    handledBillingStatus.current = billingStatus;

    if (billingStatus === 'success') {
      toast.success('Subscription activated successfully!');
      reconcileSubscription({ force: true });
      refetch({ silent: true });
    } else if (billingStatus === 'canceled') {
      toast.info('Checkout canceled');
    } else if (billingStatus === 'error') {
      toast.error('Something went wrong with your subscription');
    } else if (billingStatus === 'portal_return') {
      setShouldPollPortalReturn(true);
      reconcileSubscription({ force: true });
      refetch({ silent: true });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('billing');
    setSearchParams(nextParams, { replace: true });
  }, [billingStatus, reconcileSubscription, refetch, searchParams, setSearchParams]);

  useEffect(() => {
    if (didInitialRefetch.current) return;
    if (!user?.id) return;
    didInitialRefetch.current = true;
    reconcileSubscription();
    refetch({ silent: true });
  }, [reconcileSubscription, refetch, user?.id]);

  useEffect(() => {
    if (!shouldPollPortalReturn) return;

    let attempts = 0;
    const maxAttempts = 6;
    const interval = setInterval(() => {
      attempts += 1;
      refetch({ silent: true });
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch, shouldPollPortalReturn]);

  const handleOpenPortal = async () => {
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set('billing', 'portal_return');
      await openPortal({ returnUrl: returnUrl.toString() });
    } catch (error) {
      toast.error('Failed to open billing portal');
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      const successUrl = `${window.location.origin}/merchant/billing?billing=success`;
      const cancelUrl = `${window.location.origin}/merchant/billing?billing=canceled`;
      await createCheckout('starter', undefined, { successUrl, cancelUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start billing setup');
    }
  };

  const loading = subscriptionLoading;

  const billingCadence = useMemo(() => {
    if (subscription?.current_period_start && subscription?.current_period_end) {
      const start = new Date(subscription.current_period_start).getTime();
      const end = new Date(subscription.current_period_end).getTime();
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays >= 330) return 'annual';
    }
    return 'monthly';
  }, [subscription?.current_period_end, subscription?.current_period_start]);

  const billingCadenceLabel = billingCadence === 'annual' ? 'year' : 'month';
  const pricePerSeatMonthly = 12;
  const pricePerSeatAnnualMonthly = 9;
  const pricePerSeat = billingCadence === 'annual'
    ? pricePerSeatAnnualMonthly * 12
    : pricePerSeatMonthly;
  const pricePerSeatLabel = billingCadence === 'annual'
    ? `$${pricePerSeatAnnualMonthly} per staff/month (billed annually)`
    : `$${pricePerSeatMonthly} per staff/month`;
  const seatTotal = useMemo(() => seatUsage.total * pricePerSeat, [pricePerSeat, seatUsage.total]);
  const planSummary = useMemo(() => {
    if (!plan) return '';
    const summary: string[] = [];
    if (plan.is_unlimited_staff) {
      summary.push('Unlimited staff');
    } else if (plan.staff_included) {
      summary.push(`${plan.staff_included} staff included`);
    }
    if (plan.is_unlimited_sms) {
      summary.push('Unlimited SMS');
    } else if (plan.sms_included) {
      summary.push(`${plan.sms_included} SMS/month included`);
    }
    return summary.join(' • ');
  }, [plan]);
  const planHighlights = useMemo(() => {
    const features = (plan?.features as string[]) || [];
    if (features.length > 0) {
      return features.slice(0, 3);
    }
    return [
      'Fill last-minute cancellations automatically',
      'Instant SMS to your waitlist customers',
      'Recover revenue from openings that would go empty',
    ];
  }, [plan]);

  const trialEndLabel = subscription?.trial_end
    ? format(new Date(subscription.trial_end), 'MMMM d, yyyy')
    : null;
  const nextBillingLabel = subscription?.current_period_end
    ? format(new Date(subscription.current_period_end), 'MMMM d, yyyy')
    : null;
  const trialDaysRemaining = trialStatus?.daysRemaining;
  const trialPaymentBadgeLabel = trialEndLabel
    ? `Trial ends ${trialEndLabel}. Add payment to avoid interruption`
    : 'Trial ending soon. Add payment to avoid interruption';
  const trialEndingBadgeLabel = 'Trial Ending';
  const needsTrialPaymentBadge = isTrialing && !hasActivePaymentMethod && !trialNeedsResubscribe;
  const resolvedStatus = (() => {
    const status = subscription?.status || 'incomplete';
    if (isInTrialWindow && hasStripeSubscription && (status === 'active' || status === 'trialing')) {
      return 'trialing';
    }
    if (status === 'incomplete') {
      return 'canceled';
    }
    if (!isInTrialWindow && status === 'trialing') {
      return hasStripeSubscription ? 'active' : 'canceled';
    }
    return status;
  })();
  const shouldReactivate = trialNeedsResubscribe
    || (!isInTrialWindow && !hasStripeSubscription)
    || resolvedStatus === 'canceled';
  const manageSubscriptionLabel = shouldReactivate
    ? 'Reactivate Subscription'
    : 'Manage Subscription';
  const statusConfig = {
    trialing: {
      label: 'Trial Active',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    active: {
      label: 'Active',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    past_due: {
      label: 'Past Due',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
    paused: {
      label: 'Paused',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    canceled: {
      label: 'Canceled',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    incomplete: {
      label: 'Canceled',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    trial_needs_payment: {
      label: trialPaymentBadgeLabel,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
    trial_ending: {
      label: trialEndingBadgeLabel,
      className: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30',
    },
  };
  const isCanceling = !!subscription?.cancel_at_period_end
    && resolvedStatus !== 'canceled'
    && !trialExpired;
  const statusKey = trialNeedsResubscribe || isCanceling
    ? 'trial_ending'
    : needsTrialPaymentBadge
      ? 'trial_needs_payment'
      : (resolvedStatus as keyof typeof statusConfig);
  const statusBadge = statusConfig[statusKey] || statusConfig.incomplete;
  const showStatusBadge = !needsTrialPaymentBadge;
  const billingDateLabel = (isTrialing || isCanceledTrial)
    ? 'Trial ends'
    : hasActivePaymentMethod
      ? 'Next billing date'
      : undefined;
  const billingDateValue = (isTrialing || isCanceledTrial)
    ? trialEndLabel
    : hasActivePaymentMethod
      ? nextBillingLabel
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/merchant/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Manage Subscription</h1>
              <p className="text-muted-foreground">
                Manage your billing details and staff members
              </p>
            </div>
          </div>
          {!loading && subscription && showStatusBadge && (
            <Badge variant="secondary" className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {/* Trial & Value Summary */}
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Revenue Recovered</h2>
                {isTrialing ? (
                  <p className="text-sm text-muted-foreground">
                    {typeof trialDaysRemaining === 'number'
                      ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left in trial`
                      : 'Trial active'}
                  </p>
                ) : null}
              </div>
              <SavingsSummary
                slotsFilled={metrics?.slotsFilled || 0}
                estimatedRevenue={metrics?.estimatedRevenue || 0}
                notificationsSent={metrics?.notificationsSent || 0}
                loading={false}
                hideHeader
              />
            </div>

            {/* Past Due Warning */}
            {subscription?.status === 'past_due' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Payment Failed</AlertTitle>
                <AlertDescription>
                  Your last payment failed. Please update your payment method to avoid
                  service interruption.
                  <Button
                    variant="link"
                    className="h-auto p-0 pl-1 text-destructive underline"
                    onClick={handleOpenPortal}
                  >
                    Manage Subscription
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Seats & Pricing */}
            {subscription && plan && (
              <div className="rounded-xl border bg-card p-6 space-y-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Pricing</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage staff seats and plan details.
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Billing Frequency: <span className="font-medium capitalize">{billingCadence}</span>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <SeatManagement
                    currentSeats={seatUsage.total}
                    seatsUsed={seatUsage.used}
                    seatsIncluded={seatUsage.included}
                    maxSeats={plan.max_staff}
                    pricePerSeat={pricePerSeat}
                    pricePerSeatLabel={pricePerSeatLabel}
                    billingCadenceLabel={billingCadenceLabel}
                    billingCadence={billingCadence}
                    readOnly
                    isUnlimited={plan.is_unlimited_staff || false}
                  />
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{plan.name} Plan</p>
                          <Badge variant="secondary" className="text-[11px]">
                            Current
                          </Badge>
                        </div>
                        {planSummary && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {planSummary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Estimated total</p>
                      <p className="text-lg font-semibold">
                        ${seatTotal.toFixed(0)}/{billingCadenceLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Based on {seatUsage.total} staff seat{seatUsage.total === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {planHighlights.map((feature, index) => (
                        <div key={`${feature}-${index}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span>Plan changes are coming soon.</span>
                    </div>
                  </div>
                </div>
                {isTrialing && (
                  <p className="text-xs text-muted-foreground">
                    Changes will take effect when your trial ends. You will not be charged during your trial.
                  </p>
                )}
              </div>
            )}

            {/* Payment & Billing Management */}
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Payment Method</h3>
              </div>
              <PaymentMethodCard
                provider={hasStripeSubscription ? 'stripe' : null}
                billingDateLabel={billingDateLabel}
                billingDateValue={billingDateValue}
                onManage={shouldReactivate ? handleAddPaymentMethod : (hasStripeSubscription ? handleOpenPortal : undefined)}
                showManage={shouldReactivate || hasStripeSubscription}
                manageLabel={manageSubscriptionLabel}
                loading={portalLoading || checkoutLoading}
              />
            </div>
          </>
        )}
      </div>
  );
}

export default Billing;
