import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, ArrowRight, Gift, Users, MessageSquare, DollarSign, Plus, Minus } from 'lucide-react';
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
  isLoading?: boolean;
  trialInfo?: TrialInfo | null;
  planPricing?: PlanPricingInfo | null;
  teamSize?: string;
  seatsCount?: number;
  onSeatsChange?: (value: number) => void;
  billingCadence?: 'monthly' | 'annual';
  onBillingCadenceChange?: (value: 'monthly' | 'annual') => void;
  staffFirstName: string;
  staffLastName: string;
  staffNameError?: string | null;
  onStaffFirstNameChange: (value: string) => void;
  onStaffLastNameChange: (value: string) => void;
}

export function CompleteStep({ 
  onContinue,
  isLoading = false,
  trialInfo,
  planPricing,
  teamSize,
  seatsCount = 0,
  onSeatsChange,
  billingCadence = 'annual',
  onBillingCadenceChange,
  staffFirstName,
  staffLastName,
  staffNameError,
  onStaffFirstNameChange,
  onStaffLastNameChange
}: CompleteStepProps) {
  const trialDays = trialInfo?.daysRemaining && trialInfo.daysRemaining > 0
    ? trialInfo.daysRemaining
    : 30;

  const suggestedSeats = teamSize ? getSeatCountForTeamSize(teamSize) : 1;
  const maxSeats = planPricing?.isUnlimitedStaff ? 100 : planPricing?.maxStaff ?? 50;
  const monthlyRate = billingCadence === 'annual' ? 9 : 12;
  const [localSeats, setLocalSeats] = useState(seatsCount || suggestedSeats);

  useEffect(() => {
    if (seatsCount > 0) {
      setLocalSeats(seatsCount);
      return;
    }
    setLocalSeats(suggestedSeats);
  }, [seatsCount, suggestedSeats]);

  const seatsCost = localSeats * monthlyRate;
  const priceLabel = useMemo(() => `$${seatsCost.toFixed(0)}/mo`, [seatsCost]);

  const handleSeatChange = (value: number) => {
    const clamped = Math.max(1, Math.min(maxSeats, value));
    setLocalSeats(clamped);
    onSeatsChange?.(clamped);
  };

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
      <div className="w-full max-w-sm p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mb-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-175">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {trialInfo ? `${trialDays}-Day Free Trial` : '30-Day Free Trial'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Full access to every feature
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-xl border bg-background/80 p-4 mb-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-185">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Primary staff name</p>
            <p className="text-xs text-muted-foreground mt-1">
              This name appears on openings and customer notifications.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="onboarding-staff-first" className="text-xs">
              First name
            </Label>
            <Input
              id="onboarding-staff-first"
              value={staffFirstName}
              onChange={(e) => onStaffFirstNameChange(e.target.value)}
              placeholder="e.g., Jordan"
            />
          </div>
          <div>
            <Label htmlFor="onboarding-staff-last" className="text-xs">
              Last name or initial
            </Label>
            <Input
              id="onboarding-staff-last"
              value={staffLastName}
              onChange={(e) => onStaffLastNameChange(e.target.value)}
              placeholder="e.g., S."
            />
          </div>
        </div>
        {staffNameError && (
          <p className="mt-2 text-xs text-destructive">{staffNameError}</p>
        )}
      </div>

      <div className="w-full max-w-sm p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Staff Members</p>
            <p className="text-xs text-muted-foreground mt-1">
              ${monthlyRate}/Staff • {localSeats} <span className="mx-1 text-muted-foreground/60">|</span>
              <span className="text-foreground/80"> ${seatsCost.toFixed(0)}/Mo</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleSeatChange(localSeats - 1)}
              disabled={localSeats <= 1}
              aria-label="Decrease seats"
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
              aria-label="Increase seats"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-full border border-primary/20 bg-background/80 px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>Bill Annually</span>
          </div>
          <div className="flex items-center gap-2">
            {billingCadence === 'annual' && (
              <span className="text-[11px] font-semibold text-emerald-700">
                Save 25%
              </span>
            )}
            <Switch
              checked={billingCadence === 'annual'}
              onCheckedChange={(checked) => onBillingCadenceChange?.(checked ? 'annual' : 'monthly')}
            />
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
          <MessageSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Instant SMS to your waitlist customers</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
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
          Start free trial
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        
        {/* Trust note */}
        <p className="text-xs text-muted-foreground/70 mt-4 text-center">
          Cancel anytime
        </p>
      </div>
    </div>
  );
}
