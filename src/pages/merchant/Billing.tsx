import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useSubscription,
  useStripeCheckout,
  useBillingPortal,
} from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { SeatManagement, type SeatUpdateResponse } from '@/components/billing/SeatManagement';
import { fetchBillingApi } from '@/lib/billingApi';

interface UpdateSeatsApiResponse extends Partial<SeatUpdateResponse> {
  code?: string;
  error?: string;
  success?: boolean;
  seatCount?: number;
}

interface BillingSubscriptionApiResponse {
  usage?: {
    seats?: {
      total?: number;
    };
  };
}

type BillingBackTarget = '/merchant/settings' | '/merchant/settings/staff-locations';

interface BillingLocationState {
  backTo?: BillingBackTarget;
}

const BILLING_BACK_FALLBACK: BillingBackTarget = '/merchant/settings';

const isBillingBackTarget = (value: unknown): value is BillingBackTarget => (
  value === '/merchant/settings'
  || value === '/merchant/settings/staff-locations'
);

const isSeatUpdateStatus = (value: unknown): value is SeatUpdateResponse['status'] => (
  value === 'applied' || value === 'pending_payment' || value === 'noop'
);

const normalizeSeatUpdateResponse = (
  payload: UpdateSeatsApiResponse | null,
  requestedSeatCount: number,
  fallbackEffectiveSeatCount: number,
): SeatUpdateResponse | null => {
  if (!payload || typeof payload !== 'object') return null;

  const effectiveFromPayload = typeof payload.seatCountEffective === 'number'
    ? payload.seatCountEffective
    : typeof payload.seatCount === 'number'
      ? payload.seatCount
      : fallbackEffectiveSeatCount;

  if (isSeatUpdateStatus(payload.status)) {
    return {
      status: payload.status,
      seatCountRequested: typeof payload.seatCountRequested === 'number'
        ? payload.seatCountRequested
        : requestedSeatCount,
      seatCountEffective: effectiveFromPayload,
      ...(typeof payload.seatCountPending === 'number' ? { seatCountPending: payload.seatCountPending } : {}),
      ...(payload.invoiceId ? { invoiceId: payload.invoiceId } : {}),
      ...(payload.nextActionUrl ? { nextActionUrl: payload.nextActionUrl } : {}),
      ...(payload.message ? { message: payload.message } : {}),
    };
  }

  if (payload.success === true && typeof effectiveFromPayload === 'number') {
    return {
      status: 'applied',
      seatCountRequested: requestedSeatCount,
      seatCountEffective: effectiveFromPayload,
      ...(payload.message ? { message: payload.message } : {}),
    };
  }

  return null;
};

export function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeLocation = useLocation();
  const billingStatus = searchParams.get('billing');
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
    seatUsage,
    hasActivePaymentMethod,
    hasStripeSubscription,
    trialNeedsResubscribe,
    loading: subscriptionLoading,
    refetch,
  } = useSubscription();

  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();
  const { openPortal, loading: portalLoading } = useBillingPortal();
  const didInitialRefetch = useRef(false);

  const reconcileSubscription = useCallback(async (options?: { force?: boolean }) => {
    const merchantId = user?.id || subscription?.merchant_id;
    if (!merchantId) return;
    const now = Date.now();
    const cooldownMs = 60_000;
    if (!options?.force && now - reconcileCooldownRef.current < cooldownMs) return;
    reconcileCooldownRef.current = now;

    try {
      await fetchBillingApi('/api/billing/reconcile-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchantId }),
      });
    } catch {
      // Non-blocking: subscription webhooks + polling still reconcile eventually.
    }
  }, [subscription?.merchant_id, user?.id]);

  const waitForSeatSync = useCallback(async (merchantId: string, targetSeats: number) => {
    const maxAttempts = 6;
    const delayMs = 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await reconcileSubscription({ force: true });
        const response = await fetchBillingApi(`/api/billing/subscription/${merchantId}`);
        const payload = (await response.json().catch(() => null)) as BillingSubscriptionApiResponse | null;
        const resolvedSeats = payload?.usage?.seats?.total;
        if (response.ok && typeof resolvedSeats === 'number' && resolvedSeats === targetSeats) {
          await refetch({ silent: true });
          return true;
        }
      } catch {
        // Non-blocking: continue retries.
      }

      await refetch({ silent: true });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return false;
  }, [reconcileSubscription, refetch]);

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

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('billing');
      return next;
    }, { replace: true });
  }, [billingStatus, reconcileSubscription, refetch, setSearchParams]);

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
        setShouldPollPortalReturn(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch, shouldPollPortalReturn]);

  const handleOpenPortal = async () => {
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set('billing', 'portal_return');
      await openPortal({ returnUrl: returnUrl.toString() });
    } catch {
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

  const handleUpdateSeats = useCallback(async (newCount: number): Promise<SeatUpdateResponse> => {
    const merchantId = user?.id || subscription?.merchant_id;
    if (!merchantId) {
      throw new Error('Unable to update seats because merchant ID is missing.');
    }

    let response: Response;
    try {
      response = await fetchBillingApi('/api/billing/update-seats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchantId, seatCount: newCount }),
      });
    } catch {
      throw new Error('Unable to reach billing service right now. Please refresh and try again.');
    }

    const payload = (await response.json().catch(() => null)) as UpdateSeatsApiResponse | null;

    if (!response.ok) {
      if (payload?.code === 'PAYMENT_REQUIRED' || payload?.status === 'pending_payment') {
        return {
          status: 'pending_payment',
          seatCountRequested: newCount,
          seatCountEffective: payload?.seatCountEffective ?? seatUsage.total,
          seatCountPending: payload?.seatCountPending ?? newCount,
          invoiceId: payload?.invoiceId,
          nextActionUrl: payload?.nextActionUrl,
          message: payload?.message || 'Payment is required before the seat increase can be applied.',
        };
      }

      if (payload?.code === 'SEATS_BELOW_STAFF') {
        throw new Error(payload.error || `Cannot reduce below ${seatUsage.used} active staff member(s).`);
      }

      if (payload?.code === 'UNSUPPORTED_BILLING_PROVIDER') {
        throw new Error('In-app seat changes are available for Stripe subscriptions only.');
      }

      if (payload?.code === 'STRIPE_SEAT_ITEM_NOT_FOUND') {
        throw new Error('Unable to find your seat item in Stripe. Please contact support.');
      }

      throw new Error(payload?.error || 'Failed to update seat count.');
    }

    const result = normalizeSeatUpdateResponse(payload, newCount, seatUsage.total);
    if (!result) {
      if (payload?.error) {
        throw new Error(payload.error);
      }
      throw new Error('Seat update failed: invalid server response.');
    }

    if (result.status === 'applied') {
      toast.success('Staff seats updated.');
      const synced = await waitForSeatSync(merchantId, result.seatCountRequested);
      if (!synced) {
        toast.info('Seat update applied. Sync is still in progress.');
      }
    } else if (result.status === 'pending_payment') {
      toast.info(result.message || 'Seat update is pending payment confirmation.');
      await reconcileSubscription({ force: true });
      await refetch({ silent: true });
    }

    return result;
  }, [
    reconcileSubscription,
    refetch,
    seatUsage.total,
    seatUsage.used,
    subscription?.merchant_id,
    waitForSeatSync,
    user?.id,
  ]);

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

  const unitPriceCents = billingCadence === 'annual'
    ? (plan?.annual_price ?? plan?.monthly_price ?? 0)
    : (plan?.monthly_price ?? plan?.annual_price ?? 0);
  const fallbackUnitPrice = billingCadence === 'annual' ? 108 : 12;
  const pricePerSeat = unitPriceCents > 0 ? Math.round(unitPriceCents) / 100 : fallbackUnitPrice;

  const trialEndLabel = subscription?.trial_end
    ? format(new Date(subscription.trial_end), 'MMMM d, yyyy')
    : null;
  const nextBillingLabel = subscription?.current_period_end
    ? format(new Date(subscription.current_period_end), 'MMMM d, yyyy')
    : null;
  const cancelAtPeriodEndDateIso = subscription?.cancel_at_period_end
    ? (subscription.current_period_end || subscription.trial_end)
    : null;
  const cancelAtPeriodEndLabel = cancelAtPeriodEndDateIso
    ? format(new Date(cancelAtPeriodEndDateIso), 'MMMM d, yyyy')
    : null;
  const trialPaymentBadgeLabel = trialEndLabel
    ? `Trial ends ${trialEndLabel}. Add payment to avoid interruption`
    : 'Trial ending soon. Add payment to avoid interruption';
  const needsTrialPaymentBadge = isTrialing && !hasActivePaymentMethod && !trialNeedsResubscribe;

  const resolvedStatus = (() => {
    const status = subscription?.status || 'incomplete';
    if (isInTrialWindow && hasStripeSubscription && (status === 'active' || status === 'trialing')) {
      return 'trialing';
    }
    if (status === 'incomplete') return 'canceled';
    if (!isInTrialWindow && status === 'trialing') {
      return hasStripeSubscription ? 'active' : 'canceled';
    }
    return status;
  })();

  const shouldReactivate = trialNeedsResubscribe
    || (!isInTrialWindow && !hasStripeSubscription)
    || resolvedStatus === 'canceled';
  const manageSubscriptionLabel = shouldReactivate ? 'Reactivate Subscription' : 'Manage Subscription';
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
  };

  const statusKey = needsTrialPaymentBadge
    ? 'trial_needs_payment'
    : (resolvedStatus as keyof typeof statusConfig);
  const statusBadge = statusConfig[statusKey] || statusConfig.incomplete;
  const showStatusBadge = !needsTrialPaymentBadge;
  const billingDateLabel = subscription?.cancel_at_period_end && cancelAtPeriodEndLabel
    ? 'Cancels on'
    : (isTrialing || isCanceledTrial)
        ? 'Trial ends'
        : hasActivePaymentMethod
          ? 'Next billing date'
          : undefined;
  const billingDateValue = subscription?.cancel_at_period_end && cancelAtPeriodEndLabel
    ? cancelAtPeriodEndLabel
    : (isTrialing || isCanceledTrial)
        ? trialEndLabel
        : hasActivePaymentMethod
          ? nextBillingLabel
          : null;
  const canEditSeats = hasStripeSubscription && !shouldReactivate;
  const locationState = routeLocation.state as BillingLocationState | null;
  const backTarget = isBillingBackTarget(locationState?.backTo)
    ? locationState.backTo
    : BILLING_BACK_FALLBACK;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to={backTarget}>
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Manage Subscription</h1>
            <p className="text-muted-foreground">
              Adjust seats and payment details.
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
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {subscription?.status === 'past_due' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment Failed</AlertTitle>
              <AlertDescription>
                Your last payment failed. Update your payment method to avoid service interruption.
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

          {subscription && plan && (
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">Staff Seats</h3>
                <p className="text-sm text-muted-foreground">
                  Keep seats aligned with your active team.
                </p>
              </div>

              <SeatManagement
                currentSeats={seatUsage.total}
                seatsUsed={seatUsage.used}
                seatsIncluded={seatUsage.included}
                maxSeats={plan.max_staff}
                pricePerSeat={pricePerSeat}
                billingCadence={billingCadence}
                isUnlimited={plan.is_unlimited_staff || false}
                readOnly={!canEditSeats}
                onUpdateSeats={canEditSeats ? handleUpdateSeats : undefined}
                onManagePayment={shouldReactivate ? handleAddPaymentMethod : handleOpenPortal}
                loading={portalLoading || checkoutLoading}
              />

              {isTrialing && (
                <p className="text-xs text-muted-foreground">
                  Free trial active. Seat change charges apply after trial ends.
                </p>
              )}
            </div>
          )}

          <PaymentMethodCard
            provider={hasStripeSubscription ? 'stripe' : null}
            billingDateLabel={billingDateLabel}
            billingDateValue={billingDateValue}
            onManage={shouldReactivate ? handleAddPaymentMethod : (hasStripeSubscription ? handleOpenPortal : undefined)}
            showManage={shouldReactivate || hasStripeSubscription}
            manageLabel={manageSubscriptionLabel}
            loading={portalLoading || checkoutLoading}
          />
        </>
      )}
    </div>
  );
}

export default Billing;
