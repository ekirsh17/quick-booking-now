import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import MerchantLayout from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useSubscription, 
  useStripeCheckout,
  useBillingPortal 
} from '@/hooks/useSubscription';
import { useReportingMetrics } from '@/hooks/useReportingMetrics';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { SavingsSummary } from '@/components/billing/SavingsSummary';
import { SeatManagement } from '@/components/billing/SeatManagement';

export function Billing() {
  const [searchParams] = useSearchParams();
  const billingStatus = searchParams.get('billing');
  
  const {
    subscription,
    plan,
    isTrialing,
    trialStatus,
    seatUsage,
    hasActivePaymentMethod,
    loading: subscriptionLoading,
    refetch,
  } = useSubscription();

  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();
  const { openPortal, loading: portalLoading } = useBillingPortal();
  const { metrics } = useReportingMetrics();

  // Handle billing success/error from redirect
  useEffect(() => {
    if (billingStatus === 'success') {
      toast.success('Subscription activated successfully!');
      refetch();
    } else if (billingStatus === 'canceled') {
      toast.info('Checkout canceled');
    } else if (billingStatus === 'error') {
      toast.error('Something went wrong with your subscription');
    }
  }, [billingStatus, refetch]);

  const handleOpenPortal = async () => {
    try {
      await openPortal();
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
  const needsTrialPaymentBadge = isTrialing && !hasActivePaymentMethod;
  const manageSubscriptionLabel = subscription?.status === 'canceled' && !isTrialing
    ? 'Reactivate Subscription'
    : 'Manage Subscription';
  const statusConfig = {
    trialing: {
      label: 'Trial',
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
    canceling: {
      label: 'Canceling',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
    incomplete: {
      label: 'Setup Required',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
    trial_needs_payment: {
      label: trialPaymentBadgeLabel,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
  };
  const statusKey = needsTrialPaymentBadge
    ? 'trial_needs_payment'
    : (subscription?.cancel_at_period_end && subscription?.status !== 'canceled')
      ? 'canceling'
      : ((subscription?.status || 'incomplete') as keyof typeof statusConfig);
  const statusBadge = statusConfig[statusKey] || statusConfig.incomplete;
  const showStatusBadge = !needsTrialPaymentBadge;
  const billingDateLabel = isTrialing
    ? 'Trial ends'
    : hasActivePaymentMethod
      ? 'Next billing date'
      : undefined;
  const billingDateValue = isTrialing
    ? trialEndLabel
    : hasActivePaymentMethod
      ? nextBillingLabel
      : null;

  return (
    <MerchantLayout>
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
              <h1 className="text-2xl font-bold">Manage Billing</h1>
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
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                  <h3 className="text-lg font-semibold">Pricing</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                    Billing Frequency: <span className="font-medium capitalize">{billingCadence}</span>
                  </div>
                </div>
                <SeatManagement
                  currentSeats={seatUsage.total}
                  seatsUsed={seatUsage.used}
                  seatsIncluded={seatUsage.included}
                  maxSeats={plan.max_staff}
                  pricePerSeat={pricePerSeat}
                  pricePerSeatLabel={pricePerSeatLabel}
                  billingCadenceLabel={billingCadenceLabel}
                  trialing={isTrialing}
                  readOnly
                  isUnlimited={plan.is_unlimited_staff || false}
                />
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
                provider={hasActivePaymentMethod ? (subscription?.billing_provider as 'stripe' | 'paypal') : null}
                billingDateLabel={billingDateLabel}
                billingDateValue={billingDateValue}
                onManage={subscription?.billing_provider === 'stripe' ? handleOpenPortal : undefined}
                showManage={subscription?.billing_provider === 'stripe'}
                manageLabel="Manage Subscription"
                loading={portalLoading}
              />
            </div>
          </>
        )}
      </div>
    </MerchantLayout>
  );
}

export default Billing;
