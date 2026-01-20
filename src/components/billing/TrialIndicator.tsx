import { Sparkles, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TrialIndicatorProps {
  daysRemaining: number;
  openingsFilled: number;
  openingsMax: number;
  onUpgrade?: () => void;
}

export function TrialIndicator({
  daysRemaining,
  openingsFilled,
  openingsMax,
  onUpgrade,
}: TrialIndicatorProps) {
  const openingsPercentage = (openingsFilled / openingsMax) * 100;
  
  const isTrialEnding = daysRemaining <= 7 || openingsFilled >= openingsMax - 1;
  const isTrialEnded = daysRemaining <= 0 || openingsFilled >= openingsMax;

  // Value-focused messaging
  const getMessage = () => {
    if (isTrialEnded) {
      return {
        headline: "You've seen the value!",
        body: "Add a payment method to continue filling openings and growing your business.",
      };
    }
    if (openingsFilled >= openingsMax - 1) {
      return {
        headline: "Almost there!",
        body: "Fill one more opening to complete your trial goal. You're so close to proving the value!",
      };
    }
    if (openingsFilled > 0) {
      return {
        headline: `${openingsFilled} opening${openingsFilled === 1 ? '' : 's'} filled!`,
        body: `Fill ${openingsMax - openingsFilled} more to complete your trial. No payment until you see real value.`,
      };
    }
    return {
      headline: "Value Guarantee Trial",
      body: "Fill 2 openings to prove OpenAlert works for you. No payment required until you see results!",
    };
  };

  const message = getMessage();

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-6',
        isTrialEnded
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
          : isTrialEnding
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles
            className={cn(
              'h-5 w-5',
              isTrialEnded
                ? 'text-red-600'
                : isTrialEnding
                  ? 'text-amber-600'
                  : 'text-emerald-600',
            )}
          />
          <h3 className="font-semibold">
            {message.headline}
          </h3>
        </div>
        {!isTrialEnded && daysRemaining <= 7 && (
          <span
            className="rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-200"
          >
            {daysRemaining} days left
          </span>
        )}
      </div>

      {/* Openings Progress - Compact */}
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Openings filled</span>
          <span className={cn(
            openingsFilled >= openingsMax && "text-emerald-600 font-medium"
          )}>
            {openingsFilled} / {openingsMax}
          </span>
        </div>
        <Progress
          value={openingsPercentage}
          className={cn(
            'h-2',
            openingsFilled > 0 && '[&>div]:bg-emerald-500',
          )}
        />
      </div>

      {/* Trial Message */}
      <div
        className={cn(
          'rounded-lg p-4 text-sm',
          isTrialEnded
            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
            : isTrialEnding
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
              : 'bg-white/50 text-muted-foreground dark:bg-black/20',
        )}
      >
        <p>{message.body}</p>
      </div>

      {/* CTA Button */}
      {onUpgrade && (
        <Button
          onClick={onUpgrade}
          className={cn(
            'mt-4 w-full',
            isTrialEnded || isTrialEnding ? '' : 'opacity-80',
          )}
          variant={isTrialEnded ? 'default' : 'outline'}
          size="lg"
        >
          {isTrialEnded ? 'Add Payment Method' : 'Upgrade Plan'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default TrialIndicator;

