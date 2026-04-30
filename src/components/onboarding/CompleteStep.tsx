import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Minus, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { getSeatCountForTeamSize } from '@/types/businessProfile';

interface TrialInfo {
  daysRemaining: number;
  trialEnd: string;
  planName: string;
}

interface PlanPricingInfo {
  planName: string;
  monthlyPrice: number | null;
  staffIncluded: number;
  staffAddonPrice: number | null;
  maxStaff: number | null;
  isUnlimitedStaff: boolean;
}

interface CompleteStepProps {
  onContinue: () => void;
  onBack: () => void;
  isLoading?: boolean;
  trialInfo?: TrialInfo | null;
  planPricing?: PlanPricingInfo | null;
  teamSize?: string;
  seatsCount?: number;
  onSeatsChange?: (value: number) => void;
  billingCadence?: 'monthly' | 'annual';
  onBillingCadenceChange?: (value: 'monthly' | 'annual') => void;
}

export function CompleteStep({ 
  onContinue,
  onBack,
  isLoading = false,
  trialInfo,
  planPricing,
  teamSize,
  seatsCount = 0,
  onSeatsChange,
  billingCadence = 'annual',
  onBillingCadenceChange
}: CompleteStepProps) {
  const trialDays = trialInfo?.daysRemaining && trialInfo.daysRemaining > 0
    ? trialInfo.daysRemaining
    : 30;

  const suggestedSeats = teamSize ? getSeatCountForTeamSize(teamSize) : 1;
  const maxSeats = planPricing?.isUnlimitedStaff ? 100 : planPricing?.maxStaff ?? 50;
  const monthlyRate = billingCadence === 'annual' ? 9 : 12;
  const annualSavingsPercent = 25;
  const [localSeats, setLocalSeats] = useState(seatsCount || suggestedSeats);

  useEffect(() => {
    if (seatsCount > 0) {
      setLocalSeats(seatsCount);
      return;
    }
    setLocalSeats(suggestedSeats);
  }, [seatsCount, suggestedSeats]);

  const monthlyTotal = localSeats * monthlyRate;
  const seatLabel = localSeats === 1 ? 'seat' : 'seats';

  const billingDisclosure = billingCadence === 'annual'
    ? `${localSeats} staff ${seatLabel} • billed annually after trial`
    : `${localSeats} staff ${seatLabel} • billed monthly after trial`;

  const handleSeatChange = (value: number) => {
    const clamped = Math.max(1, Math.min(maxSeats, value));
    setLocalSeats(clamped);
    onSeatsChange?.(clamped);
  };

  return (
    <div className="flex flex-col items-center px-2 pt-2">
      <div className="sr-only">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="-ml-3 px-3"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="relative mb-4 animate-in fade-in-0 zoom-in-50 duration-500">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="absolute -top-1 -left-3 w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '100ms' }} />
        <div className="absolute -bottom-1 -right-3 w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '200ms' }} />
        <div className="absolute top-2 -left-2 w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      </div>
      
      <h1 className="text-2xl font-bold mb-2 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-100">
        Start your {trialDays}-day free trial
      </h1>
      <p className="text-sm text-muted-foreground mb-5 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-130">
        You&apos;re ready to turn cancellations into revenue
      </p>

        <div className="w-full max-w-sm rounded-xl border bg-background/90 p-4 mb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200">
        <Tabs
          value={billingCadence}
          onValueChange={(value) => onBillingCadenceChange?.(value as 'monthly' | 'annual')}
          className="w-full"
        >
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted/50 p-1">
            <TabsTrigger
              value="annual"
              disabled={isLoading}
              className="w-full rounded-md text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Annual
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              disabled={isLoading}
              className="w-full rounded-md text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Monthly
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-5">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold tracking-tight">${monthlyTotal}/mo</p>
            {billingCadence === 'annual' && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Save {annualSavingsPercent}%
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{billingDisclosure}</p>
        </div>

        <div className="mt-5 border-t pt-4 flex items-start gap-3">
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Staff Seats</p>
            <p className="text-xs text-muted-foreground mt-1">
              Adjust anytime
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleSeatChange(localSeats - 1)}
              disabled={localSeats <= 1}
              aria-label="Decrease staff seats"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-[32px] text-center text-sm font-semibold">{localSeats}</div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleSeatChange(localSeats + 1)}
              disabled={localSeats >= maxSeats}
              aria-label="Increase staff seats"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-300">
        <Button 
          onClick={onContinue} 
          size="lg" 
          className="w-full"
          disabled={isLoading}
        >
          Complete Setup
        </Button>
        
        <p className="text-xs text-muted-foreground/70 mt-4 text-center">
          No charge today. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
