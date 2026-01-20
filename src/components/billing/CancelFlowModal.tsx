import { useState } from 'react';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  MessageSquare,
  ArrowRight,
  Pause,
  ArrowDown,
  X,
  Heart,
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

interface CancelFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: {
    openingsFilled: number;
    estimatedRevenue: number;
    notificationsSent: number;
  };
  currentPlan: string;
  periodEndDate: string | null;
  canDowngrade: boolean;
  canPause: boolean;
  onCancel: (immediately: boolean) => Promise<void>;
  onPause: (months: number) => Promise<void>;
  onDowngrade: () => Promise<void>;
  loading?: boolean;
}

type Step = 'recap' | 'alternatives' | 'confirm' | 'final';
type CancelReason = 'too_expensive' | 'not_using' | 'switching' | 'other';

export function CancelFlowModal({
  open,
  onOpenChange,
  metrics,
  currentPlan,
  periodEndDate,
  canDowngrade,
  canPause,
  onCancel,
  onPause,
  onDowngrade,
  loading,
}: CancelFlowModalProps) {
  const [step, setStep] = useState<Step>('recap');
  const [cancelReason, setCancelReason] = useState<CancelReason | null>(null);
  const [pauseMonths, setPauseMonths] = useState(1);

  const handleClose = () => {
    setStep('recap');
    setCancelReason(null);
    onOpenChange(false);
  };

  const handleContinueSubscription = () => {
    handleClose();
  };

  const handleProceedToAlternatives = () => {
    setStep('alternatives');
  };

  const handleSelectAlternative = async (action: 'pause' | 'downgrade' | 'cancel') => {
    if (action === 'pause') {
      await onPause(pauseMonths);
      handleClose();
    } else if (action === 'downgrade') {
      await onDowngrade();
      handleClose();
    } else {
      setStep('confirm');
    }
  };

  const handleFinalCancel = async () => {
    setStep('final');
    await onCancel(false); // Cancel at period end, not immediately
    // Keep modal open to show final message
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === 'recap' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Before you go...
              </DialogTitle>
              <DialogDescription>
                Here's what OpenAlert has helped you achieve
              </DialogDescription>
            </DialogHeader>

            {/* Value Metrics */}
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="rounded-lg bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
                <Calendar className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {metrics.openingsFilled}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-500">
                  Openings Filled
                </div>
              </div>
              
              <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
                <DollarSign className="mx-auto mb-2 h-6 w-6 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  ${metrics.estimatedRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-500">
                  Revenue Recaptured
                </div>
              </div>
              
              <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/20">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-purple-600" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {metrics.notificationsSent}
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-500">
                  Notifications Sent
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p>
                That's <strong>${metrics.estimatedRevenue.toLocaleString()}</strong> in 
                appointments you might have lost without OpenAlert. Are you sure you 
                want to give this up?
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleContinueSubscription} className="w-full">
                Keep My Subscription
              </Button>
              <Button
                variant="ghost"
                onClick={handleProceedToAlternatives}
                className="w-full text-muted-foreground"
              >
                I still want to cancel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'alternatives' && (
          <>
            <DialogHeader>
              <DialogTitle>Would any of these help?</DialogTitle>
              <DialogDescription>
                We want to make sure OpenAlert works for you
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {/* Pause Option */}
              {canPause && (
                <button
                  onClick={() => handleSelectAlternative('pause')}
                  disabled={loading}
                  className={cn(
                    'w-full rounded-lg border-2 p-4 text-left transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Pause className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">Pause my subscription</div>
                      <div className="text-sm text-muted-foreground">
                        Take a break for up to 3 months, then resume automatically
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Downgrade Option */}
              {canDowngrade && currentPlan === 'pro' && (
                <button
                  onClick={() => handleSelectAlternative('downgrade')}
                  disabled={loading}
                  className={cn(
                    'w-full rounded-lg border-2 p-4 text-left transition-all hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                    'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <ArrowDown className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium">Downgrade to Starter</div>
                      <div className="text-sm text-muted-foreground">
                        Reduce your plan to $19/mo with 300 SMS included
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Cancel Option */}
              <button
                onClick={() => handleSelectAlternative('cancel')}
                disabled={loading}
                className={cn(
                  'w-full rounded-lg border-2 p-4 text-left transition-all hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
                  'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <X className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="font-medium">Cancel my subscription</div>
                    <div className="text-sm text-muted-foreground">
                      End subscription at current period end
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('recap')}>
                Back
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirm Cancellation
              </DialogTitle>
              <DialogDescription>
                Help us understand why you're leaving
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <RadioGroup
                value={cancelReason || ''}
                onValueChange={(v) => setCancelReason(v as CancelReason)}
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="too_expensive" id="too_expensive" />
                    <Label htmlFor="too_expensive">Too expensive</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="not_using" id="not_using" />
                    <Label htmlFor="not_using">Not using it enough</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="switching" id="switching" />
                    <Label htmlFor="switching">Switching to another service</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other">Other reason</Label>
                  </div>
                </div>
              </RadioGroup>

              {periodEndDate && (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <p>
                    Your subscription will remain active until{' '}
                    <strong>{format(new Date(periodEndDate), 'MMMM d, yyyy')}</strong>.
                    You can continue using OpenAlert until then.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep('alternatives')}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleFinalCancel}
                disabled={loading || !cancelReason}
              >
                {loading ? 'Canceling...' : 'Confirm Cancellation'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'final' && (
          <>
            <DialogHeader>
              <DialogTitle>Subscription Canceled</DialogTitle>
              <DialogDescription>
                We're sorry to see you go
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="mb-2">
                  Your subscription has been canceled. You'll continue to have
                  access until your current billing period ends.
                </p>
                {periodEndDate && (
                  <p className="font-medium">
                    Access ends: {format(new Date(periodEndDate), 'MMMM d, yyyy')}
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                <p>
                  Changed your mind? You can resubscribe anytime from the billing
                  page to pick up where you left off.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CancelFlowModal;









