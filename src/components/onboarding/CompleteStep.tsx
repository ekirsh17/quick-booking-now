import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Smartphone, Gift } from 'lucide-react';

interface TrialInfo {
  daysRemaining: number;
  trialEnd: string;
  planName: string;
}

interface CompleteStepProps {
  onContinue: () => void;
  isLoading?: boolean;
  trialInfo?: TrialInfo | null;
}

export function CompleteStep({ 
  onContinue,
  isLoading = false,
  trialInfo
}: CompleteStepProps) {
  const trialDays = trialInfo?.daysRemaining && trialInfo.daysRemaining > 0
    ? trialInfo.daysRemaining
    : 30;

  return (
    <div className="flex flex-col items-center text-center px-2">
      {/* Success animation */}
      <div className="relative mb-6 animate-in fade-in-0 zoom-in-50 duration-500">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        {/* Confetti dots */}
        <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="absolute -top-1 -left-3 w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '100ms' }} />
        <div className="absolute -bottom-1 -right-3 w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '200ms' }} />
        <div className="absolute top-2 -left-2 w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      </div>
      
      {/* Headline */}
      <h1 className="text-2xl font-bold mb-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-100">
        You're all set! 🎉
      </h1>
      <p className="text-muted-foreground mb-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
        Turn cancellations into booked appointments automatically.
      </p>
      
      {/* Trial info banner */}
      <div className="w-full max-w-sm p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-175">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {trialInfo ? `${trialDays}-Day Free Trial` : '30-Day Free Trial'}
            </p>
            <p className="text-xs text-muted-foreground">
              {trialInfo ? `${trialInfo.planName} plan` : 'Starter plan'} • Payment method required
            </p>
          </div>
        </div>
      </div>
      
      {/* What's included */}
      <div className="w-full max-w-sm space-y-2 mb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Fill last-minute cancellations automatically</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Instant SMS to your waitlist customers</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Smartphone className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Recover revenue from openings that would go empty</span>
        </div>
      </div>
      
      {/* Single CTA */}
      <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-300">
        <Button 
          onClick={onContinue} 
          size="lg" 
          className="w-full"
          disabled={isLoading}
        >
          Add payment method to start trial
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        
        {/* Trust note */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Cancel anytime • We'll remind you before your trial ends
        </p>
      </div>
    </div>
  );
}
