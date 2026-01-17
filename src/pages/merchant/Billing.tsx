import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Pause, 
  Play, 
  X, 
  ExternalLink,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import MerchantLayout from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useSubscription, 
  useStripeCheckout, 
  useBillingPortal 
} from '@/hooks/useSubscription';
import { useMerchantProfile } from '@/hooks/useMerchantProfile';
import { useReportingMetrics } from '@/hooks/useReportingMetrics';
import { PlanCard } from '@/components/billing/PlanCard';
import { UsageMetrics } from '@/components/billing/UsageMetrics';
import { TrialIndicator } from '@/components/billing/TrialIndicator';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { SubscriptionStatus } from '@/components/billing/SubscriptionStatus';
import { CancelFlowModal } from '@/components/billing/CancelFlowModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { SavingsSummary } from '@/components/billing/SavingsSummary';
import { SeatManagement } from '@/components/billing/SeatManagement';
import type { Tables } from '@/integrations/supabase/types';

type Plan = Tables<'plans'>;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function Billing() {
  const [searchParams] = useSearchParams();
  const billingStatus = searchParams.get('billing');
  
  const {
    subscription,
    plan,
    isTrialing,
    isActive,
    isPaused,
    isCanceled,
    trialStatus,
    smsUsage,
    seatUsage,
    loading: subscriptionLoading,
    refetch,
    createTrialSubscription,
  } = useSubscription();

  const { createCheckout, loading: stripeLoading } = useStripeCheckout();
  const { openPortal, loading: portalLoading } = useBillingPortal();
  const { metrics } = useReportingMetrics();
  const { profile: merchantProfile } = useMerchantProfile();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const primaryPlanId = plans.find((p) => p.is_active && p.id !== 'enterprise')?.id || 'starter';

  // Fetch all plans
  useEffect(() => {
    async function fetchPlans() {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (data) {
        setPlans(data);
      }
      setPlansLoading(false);
    }

    fetchPlans();
  }, []);

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

  // Create trial subscription for new users
  useEffect(() => {
    if (!subscriptionLoading && !subscription) {
      createTrialSubscription();
    }
  }, [subscriptionLoading, subscription, createTrialSubscription]);

  const handleStripeCheckout = async (planId: string) => {
    try {
      await createCheckout(planId as 'starter' | 'pro', merchantProfile?.email || undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
    }
  };

  const handleOpenPortal = async () => {
    try {
      await openPortal();
    } catch (error) {
      toast.error('Failed to open billing portal');
    }
  };

  const handleCancel = async (immediately: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: subscription?.merchant_id,
          immediately,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      toast.success('Subscription canceled');
      refetch();
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (months: number) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/billing/pause-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: subscription?.merchant_id,
          pauseMonths: months,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pause subscription');
      }

      toast.success('Subscription paused');
      refetch();
    } catch (error) {
      toast.error('Failed to pause subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/billing/resume-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: subscription?.merchant_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume subscription');
      }

      toast.success('Subscription resumed');
      refetch();
    } catch (error) {
      toast.error('Failed to resume subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/billing/upgrade-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: subscription?.merchant_id,
          newPlanId: 'starter',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change plan');
      }

      toast.success('Downgraded to Starter plan');
      refetch();
    } catch (error) {
      toast.error('Failed to change plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSeats = async (newSeatCount: number) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/billing/update-seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: subscription?.merchant_id,
          seatCount: newSeatCount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update seats');
      }

      toast.success(`Seats updated to ${newSeatCount}`);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update seats');
    } finally {
      setActionLoading(false);
    }
  };

  const loading = subscriptionLoading || plansLoading;
  const checkoutLoading = stripeLoading;

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
              Manage your plan, usage, and payment method
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
            {/* Trial Indicator */}
            {isTrialing && trialStatus && (
              <TrialIndicator
                daysRemaining={trialStatus.daysRemaining}
                openingsFilled={trialStatus.openingsFilled}
                openingsMax={2}
                onUpgrade={() => handleStripeCheckout(primaryPlanId)}
              />
            )}

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

            {/* Current Subscription */}
            {subscription && plan && !isTrialing && (
              <SubscriptionStatus
                status={subscription.status || 'incomplete'}
                planName={plan.name}
                monthlyPrice={plan.monthly_price / 100}
                currentPeriodEnd={subscription.current_period_end}
                cancelAtPeriodEnd={subscription.cancel_at_period_end || false}
                pauseResumesAt={subscription.pause_resumes_at}
              />
            )}

            {/* Usage Metrics */}
            {subscription && plan && (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Usage This Period</h3>
                <UsageMetrics
                  smsUsed={smsUsage.used}
                  smsIncluded={smsUsage.included}
                  seatsUsed={seatUsage.used}
                  seatsIncluded={seatUsage.included}
                  seatsTotal={seatUsage.total}
                  overageCost={smsUsage.overageCost}
                  additionalSeatsCost={seatUsage.additional * (plan.staff_addon_price || 0) / 100}
                />
              </div>
            )}

            {/* Savings Summary - Value display */}
            {subscription && !isTrialing && (
              <SavingsSummary
                slotsFilled={metrics?.slotsFilled || 0}
                estimatedRevenue={metrics?.estimatedRevenue || 0}
                avgAppointmentValue={metrics?.avgAppointmentValue || 70}
                loading={false}
              />
            )}

            {/* Staff Seats Management - Starter plan only */}
            {subscription && plan && plan.id === 'starter' && subscription.billing_provider && (
              <SeatManagement
                currentSeats={seatUsage.total}
                seatsUsed={seatUsage.used}
                seatsIncluded={seatUsage.included}
                maxSeats={plan.max_staff}
                pricePerSeat={(plan.staff_addon_price || 1000) / 100}
                isUnlimited={plan.is_unlimited_staff || false}
                onUpdateSeats={handleUpdateSeats}
                loading={actionLoading}
              />
            )}

            {/* Payment Method */}
            {subscription && subscription.billing_provider && (
              <PaymentMethodCard
                provider={subscription.billing_provider as 'stripe' | 'paypal'}
                onManage={subscription.billing_provider === 'stripe' ? handleOpenPortal : undefined}
                loading={portalLoading}
              />
            )}

            {/* Plans Comparison */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {isActive || isPaused ? 'Change Plan' : 'Available Plans'}
                </h3>
                {subscription?.billing_provider === 'stripe' && (isActive || isPaused) && (
                  <Button variant="outline" size="sm" onClick={handleOpenPortal}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Stripe Portal
                  </Button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {plans
                  .filter((p) => p.id !== 'enterprise')
                  .map((p) => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      isCurrentPlan={p.id === subscription?.plan_id}
                      isPopular={p.id === 'pro'}
                      isUpgrade={subscription?.plan_id === 'starter' && p.id === 'pro'}
                      isDowngrade={subscription?.plan_id === 'pro' && p.id === 'starter'}
                      loading={checkoutLoading}
                      disabled={p.id === subscription?.plan_id}
                      onSelect={
                        p.id !== subscription?.plan_id
                          ? () => {
                              if (!subscription?.billing_provider) {
                                setShowUpgradeModal(true);
                              } else if (subscription?.billing_provider === 'stripe') {
                                handleOpenPortal();
                              }
                            }
                          : undefined
                      }
                    />
                  ))}
              </div>

              {/* Enterprise CTA */}
              <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                <h4 className="font-semibold">Need more?</h4>
                <p className="mb-3 text-sm text-muted-foreground">
                  Enterprise plans include unlimited everything, multi-location support,
                  and a dedicated customer success manager.
                </p>
                <Button variant="outline" asChild>
                  <a href="mailto:sales@notifyme.app">Contact Sales</a>
                </Button>
              </div>
            </div>

            {/* Subscription Management */}
            {subscription && (isActive || isPaused) && subscription.billing_provider && (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Manage Subscription</h3>
                <div className="flex flex-wrap gap-3">
                  {isPaused ? (
                    <Button
                      variant="outline"
                      onClick={handleResume}
                      disabled={actionLoading}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Resume Subscription
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Simple pause for now - could be a modal
                        handlePause(1);
                      }}
                      disabled={actionLoading}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause (1 month)
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setShowCancelModal(true)}
                    disabled={actionLoading}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Subscription
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modals */}
        <CancelFlowModal
          open={showCancelModal}
          onOpenChange={setShowCancelModal}
          metrics={{
            openingsFilled: metrics?.slotsFilled || 0,
            estimatedRevenue: metrics?.estimatedRevenue || 0,
            notificationsSent: metrics?.notificationsSent || 0,
          }}
          currentPlan={subscription?.plan_id || 'starter'}
          periodEndDate={subscription?.current_period_end || null}
          canDowngrade={subscription?.plan_id === 'pro'}
          canPause={true}
          onCancel={handleCancel}
          onPause={handlePause}
          onDowngrade={handleDowngrade}
          loading={actionLoading}
        />

        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          plans={plans}
          currentPlanId={subscription?.plan_id || null}
          merchantId={subscription?.merchant_id || ''}
          onSelectStripe={handleStripeCheckout}
          onSuccess={() => {
            toast.success('Subscription activated successfully!');
            refetch();
          }}
          loading={checkoutLoading}
        />
      </div>
    </MerchantLayout>
  );
}

export default Billing;
