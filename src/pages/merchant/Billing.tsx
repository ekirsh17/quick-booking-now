import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useStripeCheckout,
  useBillingPortal,
  notifySubscriptionRefresh,
} from '@/hooks/useSubscription';
import { useSubscriptionUiState } from '@/hooks/useSubscriptionUiState';
import { useAuth } from '@/hooks/useAuth';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { SeatManagement, type SeatUpdateResponse } from '@/components/billing/SeatManagement';
import { fetchBillingApi } from '@/lib/billingApi';
import { cn } from '@/lib/utils';

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
  paymentMethod?: {
    type?: 'card' | null;
    brand?: string | null;
    last4?: string | null;
  } | null;
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
  const [optimisticSeatCount, setOptimisticSeatCount] = useState<number | null>(null);
  const [paymentMethodSummary, setPaymentMethodSummary] = useState<{
    type: 'card';
    brand: string | null;
    last4: string | null;
  } | null>(null);
  const { user } = useAuth();

  const {
    subscription,
    plan,
    isTrialing,
    isInTrialWindow,
    seatUsage,
    hasActivePaymentMethod,
    hasStripeSubscription,
    trialNeedsResubscribe,
    isSubscriptionCancelingAtPeriodEnd,
    loading: subscriptionLoading,
    refetch,
    ui,
  } = useSubscriptionUiState();

  useEffect(() => {
    if (optimisticSeatCount !== null && seatUsage.total === optimisticSeatCount) {
      setOptimisticSeatCount(null);
    }
  }, [optimisticSeatCount, seatUsage.total]);

  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();
  const { openPortal, loading: portalLoading } = useBillingPortal();

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
        if (payload?.paymentMethod?.type === 'card') {
          setPaymentMethodSummary({
            type: 'card',
            brand: payload.paymentMethod.brand ?? null,
            last4: payload.paymentMethod.last4 ?? null,
          });
        }
        if (response.ok && typeof resolvedSeats === 'number' && resolvedSeats === targetSeats) {
          await refetch({ silent: true });
          notifySubscriptionRefresh();
          return true;
        }
      } catch {
        // Non-blocking: continue retries.
      }

      await refetch({ silent: true });
      notifySubscriptionRefresh();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return false;
  }, [reconcileSubscription, refetch]);

  const merchantId = user?.id || subscription?.merchant_id;

  const refreshPaymentMethodSummary = useCallback(async () => {
    if (!merchantId || !hasStripeSubscription) {
      setPaymentMethodSummary(null);
      return;
    }

    try {
      const response = await fetchBillingApi(`/api/billing/subscription/${merchantId}`);
      if (!response.ok) {
        setPaymentMethodSummary(null);
        return;
      }
      const payload = (await response.json().catch(() => null)) as BillingSubscriptionApiResponse | null;
      if (payload?.paymentMethod?.type === 'card') {
        setPaymentMethodSummary({
          type: 'card',
          brand: payload.paymentMethod.brand ?? null,
          last4: payload.paymentMethod.last4 ?? null,
        });
        return;
      }
      setPaymentMethodSummary(null);
    } catch {
      setPaymentMethodSummary(null);
    }
  }, [hasStripeSubscription, merchantId]);

  useEffect(() => {
    if (!billingStatus || handledBillingStatus.current === billingStatus) return;
    handledBillingStatus.current = billingStatus;

    const finishStripeReturn = async () => {
      if (billingStatus === 'success') {
        toast.success('Subscription activated successfully!');
        await reconcileSubscription({ force: true });
        await refetch({ silent: true });
        notifySubscriptionRefresh();
      } else if (billingStatus === 'portal_return') {
        setShouldPollPortalReturn(true);
        await reconcileSubscription({ force: true });
        await refetch({ silent: true });
        notifySubscriptionRefresh();
      }
    };

    if (billingStatus === 'success' || billingStatus === 'portal_return') {
      void finishStripeReturn();
    } else if (billingStatus === 'canceled') {
      toast.info('Checkout canceled');
    } else if (billingStatus === 'error') {
      toast.error('Something went wrong with your subscription');
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('billing');
      return next;
    }, { replace: true });
  }, [billingStatus, reconcileSubscription, refetch, setSearchParams]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      await reconcileSubscription({ force: true });
      await refetch({ silent: true });
      notifySubscriptionRefresh();
    })();
  }, [reconcileSubscription, refetch, user?.id]);

  useEffect(() => {
    void refreshPaymentMethodSummary();
  }, [refreshPaymentMethodSummary, subscription?.updated_at]);

  useEffect(() => {
    if (!shouldPollPortalReturn) return;

    let attempts = 0;
    const maxAttempts = 6;
    const interval = setInterval(() => {
      attempts += 1;
      void refetch({ silent: true }).then(() => notifySubscriptionRefresh());
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
      setOptimisticSeatCount(result.seatCountEffective);
      await refetch({ silent: true });
      notifySubscriptionRefresh();
      const synced = await waitForSeatSync(merchantId, result.seatCountEffective);
      if (!synced) {
        toast.info('Seat update applied. Sync is still in progress.');
      }
    } else if (result.status === 'pending_payment') {
      toast.info(result.message || 'Seat update is pending payment confirmation.');
      await reconcileSubscription({ force: true });
      await refetch({ silent: true });
      notifySubscriptionRefresh();
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
  const shouldReactivate = trialNeedsResubscribe
    || (!isInTrialWindow && !hasStripeSubscription)
    || ui?.kind === 'expired';
  const manageSubscriptionLabel = shouldReactivate ? 'Reactivate Subscription' : 'Update billing';

  const { billingDateLabel, billingDateValue } = useMemo(() => {
    if (!subscription || !ui) {
      return { billingDateLabel: undefined as string | undefined, billingDateValue: null as string | null };
    }

    const syncingFallback = 'Date syncing — open Manage Subscription to confirm.';

    switch (ui.kind) {
      case 'trial_active':
      case 'trial_expiring':
        return {
          billingDateLabel: 'Trial ends',
          billingDateValue: trialEndLabel ?? syncingFallback,
        };
      case 'expiring':
        return {
          billingDateLabel: isSubscriptionCancelingAtPeriodEnd
            ? (cancelAtPeriodEndLabel ? 'Cancels on' : 'Cancels at period end')
            : 'Current period ends',
          billingDateValue: isSubscriptionCancelingAtPeriodEnd
            ? (cancelAtPeriodEndLabel ?? syncingFallback)
            : (nextBillingLabel ?? syncingFallback),
        };
      case 'active':
        return {
          billingDateLabel: hasActivePaymentMethod ? 'Next charge' : undefined,
          billingDateValue: hasActivePaymentMethod ? nextBillingLabel : null,
        };
      case 'expired':
      default:
        return { billingDateLabel: undefined, billingDateValue: null };
    }
  }, [
    subscription,
    ui,
    trialEndLabel,
    nextBillingLabel,
    cancelAtPeriodEndLabel,
    isSubscriptionCancelingAtPeriodEnd,
    hasActivePaymentMethod,
  ]);
  const canEditSeats = hasStripeSubscription && !shouldReactivate;
  const effectiveSeatTotal = optimisticSeatCount ?? seatUsage.total;
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
              Manage billing and staff seat coverage.
            </p>
          </div>
        </div>
        {!loading && subscription && ui && (
          <Badge variant="secondary" className={cn('self-start sm:self-auto', ui.pillClassName)}>
            {ui.pillLabel}
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
          {subscription && plan && (
            <div className="space-y-3">
              <SeatManagement
                currentSeats={effectiveSeatTotal}
                seatsUsed={seatUsage.used}
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
            paymentMethodType={paymentMethodSummary?.type ?? null}
            paymentMethodBrand={paymentMethodSummary?.brand ?? null}
            paymentMethodLast4={paymentMethodSummary?.last4 ?? null}
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
