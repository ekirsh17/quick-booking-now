import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CreditCard, ArrowRight, Check, ArrowLeft, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { PayPalCheckoutButton } from './PayPalCheckoutButton';

type Plan = Tables<'plans'>;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Initialize Stripe outside component to avoid recreating on each render
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: Plan[];
  currentPlanId: string | null;
  merchantId: string;
  merchantEmail?: string;
  onSelectStripe: (planId: string) => Promise<void>;
  onSuccess?: () => void;
  loading?: boolean;
}

type PaymentProvider = 'stripe' | 'paypal';
type Step = 'plan' | 'payment' | 'stripe-checkout' | 'paypal-checkout';

export function UpgradeModal({
  open,
  onOpenChange,
  plans,
  currentPlanId,
  merchantId,
  merchantEmail,
  onSelectStripe,
  onSuccess,
  loading,
}: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('stripe');
  const [step, setStep] = useState<Step>('plan');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out enterprise and current plan
  const availablePlans = plans.filter(
    (p) => p.id !== 'enterprise' && p.id !== currentPlanId && p.is_active
  );

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setStep('payment');
    setError(null);
  };

  const handleContinueToCheckout = async () => {
    if (!selectedPlan) return;
    setError(null);

    if (selectedProvider === 'stripe') {
      // Use embedded checkout if Stripe PK is available
      if (STRIPE_PK) {
        setCheckoutLoading(true);
        try {
          const response = await fetch(`${API_URL}/api/billing/create-embedded-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merchantId,
              planId: selectedPlan,
              email: merchantEmail,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout session');
          }

          setClientSecret(data.clientSecret);
          setSubscriptionId(data.subscriptionId);
          setStep('stripe-checkout');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to start checkout');
        } finally {
          setCheckoutLoading(false);
        }
      } else {
        // Fallback to redirect checkout
        await onSelectStripe(selectedPlan);
      }
    } else {
      // PayPal flow - use embedded checkout
      setStep('paypal-checkout');
    }
  };

  const handleCheckoutSuccess = () => {
    onSuccess?.();
    handleClose();
  };

  const handleCheckoutError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleClose = () => {
    setSelectedPlan(null);
    setStep('plan');
    setClientSecret(null);
    setSubscriptionId(null);
    setError(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'stripe-checkout' || step === 'paypal-checkout') {
      setStep('payment');
      setClientSecret(null);
      setSubscriptionId(null);
    } else if (step === 'payment') {
      setStep('plan');
      setSelectedPlan(null);
    }
    setError(null);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedPlan(null);
      setStep('plan');
      setClientSecret(null);
      setSubscriptionId(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && step === 'plan' && !selectedPlan && availablePlans.length === 1) {
      setSelectedPlan(availablePlans[0].id);
      setStep('payment');
      setError(null);
    }
  }, [open, step, selectedPlan, availablePlans]);

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Step 1: Plan Selection */}
        {step === 'plan' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Your Plan</DialogTitle>
              <DialogDescription>
                Select the plan that works best for your business
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {availablePlans.map((plan) => {
                const isUpgrade = currentPlanId === 'starter' && plan.id === 'pro';
                const features = (plan.features as string[]) || [];

                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={cn(
                      'w-full rounded-xl border-2 p-4 text-left transition-all',
                      'hover:border-primary hover:shadow-md',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{plan.name}</h4>
                          {isUpgrade && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-2xl font-bold">
                          ${plan.monthly_price / 100}
                          <span className="text-sm font-normal text-muted-foreground">
                            /month
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 text-muted-foreground" />
                    </div>

                    <ul className="mt-3 space-y-1">
                      {features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3 w-3 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Payment Method Selection */}
        {step === 'payment' && selectedPlanData && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Payment Method</DialogTitle>
              <DialogDescription>
                Subscribe to {selectedPlanData.name} for ${selectedPlanData.monthly_price / 100}/month
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <RadioGroup
                value={selectedProvider}
                onValueChange={(v) => setSelectedProvider(v as PaymentProvider)}
                className="space-y-3"
              >
                {/* Stripe Option */}
                <label
                  htmlFor="stripe"
                  className={cn(
                    'flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all',
                    selectedProvider === 'stripe'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <RadioGroupItem value="stripe" id="stripe" />
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="stripe" className="cursor-pointer font-medium">
                      Credit or Debit Card
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Pay securely with Stripe
                    </p>
                  </div>
                </label>

                {/* PayPal Option */}
                <label
                  htmlFor="paypal"
                  className={cn(
                    'flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all',
                    selectedProvider === 'paypal'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <RadioGroupItem value="paypal" id="paypal" />
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0070ba]">
                    {/* Official PayPal logo */}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="white">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.645h6.867c2.285 0 4.063.6 5.103 1.725.97 1.05 1.3 2.535.97 4.395l-.002.014c-.404 2.538-1.737 4.148-3.538 4.99-1.5.7-3.372.975-5.512.975h-.85c-.442 0-.818.32-.885.756l-.58 3.647-.166 1.05a.463.463 0 0 1-.457.39H7.076z"/>
                      <path d="M18.47 7.68c-.09.55-.21 1.07-.38 1.57-1.08 3.13-3.96 4.22-7.08 4.22h-.88c-.5 0-.92.36-.99.85l-.86 5.32-.25 1.54a.47.47 0 0 0 .46.55h3.24c.44 0 .81-.32.88-.75l.04-.18.69-4.32.04-.24c.07-.43.44-.75.88-.75h.55c3.58 0 6.38-1.45 7.2-5.65.34-1.75.17-3.22-.74-4.25-.27-.31-.61-.57-1-.79z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="paypal" className="cursor-pointer font-medium">
                      PayPal
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Pay with your PayPal account
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {/* Value Guarantee Notice */}
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                <p>
                  <strong>Value Guarantee:</strong> You won't be charged until you fill 2 openings.
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleContinueToCheckout} 
                disabled={loading || checkoutLoading} 
                className="gap-2"
              >
                {loading || checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : selectedProvider === 'stripe' ? (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue to PayPal
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Stripe Embedded Checkout */}
        {step === 'stripe-checkout' && selectedPlanData && clientSecret && stripePromise && (
          <>
            <DialogHeader>
              <DialogTitle>Complete Payment</DialogTitle>
              <DialogDescription>
                Enter your payment details for {selectedPlanData.name}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#7c3aed',
                      borderRadius: '8px',
                    },
                  },
                }}
              >
                <StripeCheckoutForm
                  planName={selectedPlanData.name}
                  monthlyPrice={selectedPlanData.monthly_price / 100}
                  subscriptionId={subscriptionId!}
                  merchantId={merchantId}
                  onSuccess={handleCheckoutSuccess}
                  onError={handleCheckoutError}
                />
              </Elements>

              {/* Value Guarantee Notice */}
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                <p>
                  <strong>Value Guarantee:</strong> You won't be charged until you fill 2 openings.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3b: PayPal Embedded Checkout */}
        {step === 'paypal-checkout' && selectedPlanData && (
          <>
            <DialogHeader>
              <DialogTitle>Complete Payment with PayPal</DialogTitle>
              <DialogDescription>
                Subscribe to {selectedPlanData.name} for ${selectedPlanData.monthly_price / 100}/month
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <PayPalCheckoutButton
                planId={selectedPlanData.id}
                planName={selectedPlanData.name}
                monthlyPrice={selectedPlanData.monthly_price / 100}
                merchantId={merchantId}
                onSuccess={handleCheckoutSuccess}
                onError={handleCheckoutError}
              />

              {/* Value Guarantee Notice */}
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                <p>
                  <strong>Value Guarantee:</strong> You won't be charged until you fill 2 openings.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
