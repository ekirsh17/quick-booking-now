import { useState } from 'react';
import { 
  CreditCard, 
  Wallet, 
  ArrowRight, 
  Target, 
  DollarSign,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
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

type Plan = Tables<'plans'>;

interface TrialEndModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trialReason: 'openings_filled' | 'time_expired' | null;
  openingsFilled: number;
  estimatedValue: number;
  plans: Plan[];
  onSelectStripe: (planId: string) => Promise<void>;
  onSelectPayPal: (planId: string) => Promise<void>;
  loading?: boolean;
}

type PaymentProvider = 'stripe' | 'paypal';

export function TrialEndModal({
  open,
  onOpenChange,
  trialReason,
  openingsFilled,
  estimatedValue,
  plans,
  onSelectStripe,
  onSelectPayPal,
  loading,
}: TrialEndModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('starter');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('stripe');
  const [step, setStep] = useState<'value' | 'plan' | 'payment'>('value');

  const availablePlans = plans.filter(
    (p) => p.id !== 'enterprise' && p.is_active
  );

  const handleContinue = () => {
    if (step === 'value') {
      setStep('plan');
    } else if (step === 'plan') {
      setStep('payment');
    }
  };

  const handleConfirm = async () => {
    if (selectedProvider === 'stripe') {
      await onSelectStripe(selectedPlan);
    } else {
      await onSelectPayPal(selectedPlan);
    }
  };

  const isOpeningsBased = trialReason === 'openings_filled';
  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === 'value' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isOpeningsBased ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    You've Proven NotifyMe's Value!
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Your Trial Has Ended
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {isOpeningsBased
                  ? "Congratulations! You've filled 2 openings with NotifyMe."
                  : 'Your 30-day trial period has ended.'}
              </DialogDescription>
            </DialogHeader>

            {/* Value Summary */}
            <div className="grid grid-cols-2 gap-4 py-6">
              <div className="rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
                <Target className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {openingsFilled}
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-500">
                  Openings Filled
                </div>
              </div>
              
              <div className="rounded-xl bg-blue-50 p-4 text-center dark:bg-blue-900/20">
                <DollarSign className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                  ${estimatedValue.toLocaleString()}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-500">
                  Revenue Recaptured
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="rounded-lg bg-muted p-4 text-sm">
              {isOpeningsBased ? (
                <p>
                  <strong>That's real money</strong> you would have lost without NotifyMe. 
                  Add a payment method now to keep filling openings and growing your business.
                </p>
              ) : (
                <p>
                  You've had 30 days to try NotifyMe.{' '}
                  {openingsFilled > 0 ? (
                    <>
                      You filled <strong>{openingsFilled} opening{openingsFilled !== 1 && 's'}</strong>,
                      recapturing approximately <strong>${estimatedValue.toLocaleString()}</strong>.
                    </>
                  ) : (
                    <>
                      Add a payment method to start filling openings and recapturing lost revenue.
                    </>
                  )}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleContinue} className="w-full gap-2">
                Choose Your Plan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'plan' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Your Plan</DialogTitle>
              <DialogDescription>
                Select the plan that works best for your business
              </DialogDescription>
            </DialogHeader>

            <RadioGroup
              value={selectedPlan}
              onValueChange={setSelectedPlan}
              className="space-y-3 py-4"
            >
              {availablePlans.map((plan) => {
                const features = (plan.features as string[]) || [];
                
                return (
                  <label
                    key={plan.id}
                    htmlFor={plan.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all',
                      selectedPlan === plan.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={plan.id} className="cursor-pointer font-semibold">
                          {plan.name}
                        </Label>
                        <span className="font-bold">
                          ${plan.monthly_price / 100}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep('value')}>
                Back
              </Button>
              <Button onClick={handleContinue} className="gap-2">
                Choose Payment Method
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'payment' && selectedPlanData && (
          <>
            <DialogHeader>
              <DialogTitle>Complete Your Subscription</DialogTitle>
              <DialogDescription>
                {selectedPlanData.name} Plan • ${selectedPlanData.monthly_price / 100}/month
              </DialogDescription>
            </DialogHeader>

            <RadioGroup
              value={selectedProvider}
              onValueChange={(v) => setSelectedProvider(v as PaymentProvider)}
              className="space-y-3 py-4"
            >
              {/* Stripe Option */}
              <label
                htmlFor="payment-stripe"
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all',
                  selectedProvider === 'stripe'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <RadioGroupItem value="stripe" id="payment-stripe" />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="payment-stripe" className="cursor-pointer font-medium">
                    Credit or Debit Card
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Pay securely with Stripe
                  </p>
                </div>
              </label>

              {/* PayPal Option */}
              <label
                htmlFor="payment-paypal"
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all',
                  selectedProvider === 'paypal'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <RadioGroupItem value="paypal" id="payment-paypal" />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="payment-paypal" className="cursor-pointer font-medium">
                    PayPal
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Pay with your PayPal account
                  </p>
                </div>
              </label>
            </RadioGroup>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep('plan')}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={loading} className="gap-2">
                {loading ? (
                  'Processing...'
                ) : selectedProvider === 'stripe' ? (
                  <>
                    Continue to Checkout
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
      </DialogContent>
    </Dialog>
  );
}

export default TrialEndModal;

