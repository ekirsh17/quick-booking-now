import { useState } from 'react';
import { CreditCard, Wallet, ArrowRight, Check } from 'lucide-react';
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

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: Plan[];
  currentPlanId: string | null;
  onSelectStripe: (planId: string) => Promise<void>;
  onSelectPayPal: (planId: string) => Promise<void>;
  loading?: boolean;
}

type PaymentProvider = 'stripe' | 'paypal';

export function UpgradeModal({
  open,
  onOpenChange,
  plans,
  currentPlanId,
  onSelectStripe,
  onSelectPayPal,
  loading,
}: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('stripe');
  const [step, setStep] = useState<'plan' | 'payment'>('plan');

  // Filter out enterprise and current plan
  const availablePlans = plans.filter(
    (p) => p.id !== 'enterprise' && p.id !== currentPlanId && p.is_active
  );

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setStep('payment');
  };

  const handleConfirm = async () => {
    if (!selectedPlan) return;

    if (selectedProvider === 'stripe') {
      await onSelectStripe(selectedPlan);
    } else {
      await onSelectPayPal(selectedPlan);
    }
  };

  const handleClose = () => {
    setSelectedPlan(null);
    setStep('plan');
    onOpenChange(false);
  };

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

        {step === 'payment' && selectedPlanData && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Payment Method</DialogTitle>
              <DialogDescription>
                Subscribe to {selectedPlanData.name} for ${selectedPlanData.monthly_price / 100}/month
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                    <Wallet className="h-5 w-5 text-white" />
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

              {/* Trial Notice */}
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                <p>
                  <strong>30-day Value Guarantee:</strong> Try NotifyMe risk-free. 
                  Your card won't be charged until you fill 2 openings or 30 days pass.
                </p>
              </div>
            </div>

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

export default UpgradeModal;

