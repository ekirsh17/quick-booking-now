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

  return (
    <MerchantLayout>
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/merchant/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Manage Billing</h1>
            <p className="text-muted-foreground">
              Manage your billing details and staff seats
            </p>
          </div>
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
                <h2 className="text-lg font-semibold">Trial & value summary</h2>
                {isTrialing ? (
                  <p className="text-sm text-muted-foreground">
                    You're currently on a free trial
                    {typeof trialDaysRemaining === 'number'
                      ? ` — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining`
                      : '.'}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your NotifyMe subscription is active.
                  </p>
                )}
                {isTrialing && trialEndLabel && (
                  <p className="text-sm text-muted-foreground">
                    Trial ends on {trialEndLabel}. Your subscription will start automatically unless you cancel.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This is the value NotifyMe has helped generate{isTrialing ? ' so far during your trial.' : ' so far.'}
              </p>
              <SavingsSummary
                slotsFilled={metrics?.slotsFilled || 0}
                estimatedRevenue={metrics?.estimatedRevenue || 0}
                notificationsSent={metrics?.notificationsSent || 0}
                loading={false}
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
                    Update payment method
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Seats & Pricing */}
            {subscription && plan && (
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Seats & pricing</h3>
                    <p className="text-sm text-muted-foreground">
                      Pricing is based on the number of staff members using NotifyMe.
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Billing cadence: <span className="font-medium capitalize">{billingCadence}</span>
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

            {/* Plan Details */}
            <div className="rounded-xl border bg-card p-6 space-y-2">
              <h3 className="text-lg font-semibold">
                {plan?.name || 'NotifyMe - Staff-Based Plan'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Pricing is based on the number of staff members using NotifyMe.
              </p>
              <p className="text-sm text-muted-foreground">
                {billingCadence === 'annual'
                  ? '$9 per staff / month when billed annually.'
                  : '$12 per staff / month.'}
              </p>
              {isTrialing && (
                <p className="text-sm text-muted-foreground">
                  You won't be charged until your trial ends.
                </p>
              )}
            </div>

            {/* Payment & Billing Management */}
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Payment & billing</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your payment method and view invoices in Stripe.
                </p>
              </div>
              <PaymentMethodCard
                provider={(subscription?.billing_provider as 'stripe' | 'paypal') || null}
                billingDateLabel={isTrialing ? 'Trial ends' : 'Next billing date'}
                billingDateValue={isTrialing ? trialEndLabel : nextBillingLabel}
                onManage={subscription?.billing_provider === 'stripe' ? handleOpenPortal : undefined}
                loading={portalLoading}
              />
              {!subscription?.billing_provider && (
                <Button onClick={handleAddPaymentMethod} disabled={checkoutLoading}>
                  {checkoutLoading ? 'Starting...' : 'Add payment method to start trial'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </MerchantLayout>
  );
}

export default Billing;
