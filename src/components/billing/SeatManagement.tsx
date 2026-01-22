import { useMemo, useState } from 'react';
import { Plus, Minus, Users, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

interface SeatManagementProps {
  currentSeats: number;
  seatsUsed: number;
  seatsIncluded: number;
  maxSeats: number | null;
  pricePerSeat: number;
  pricePerSeatLabel: string;
  billingCadenceLabel: string;
  billingCadence?: 'monthly' | 'annual';
  onBillingCadenceChange?: (value: 'monthly' | 'annual') => void;
  readOnly?: boolean;
  isUnlimited: boolean;
  onUpdateSeats?: (newCount: number) => Promise<void>;
  loading?: boolean;
}

export function SeatManagement({
  currentSeats,
  seatsUsed,
  seatsIncluded,
  maxSeats,
  pricePerSeat,
  pricePerSeatLabel,
  billingCadenceLabel,
  billingCadence = 'monthly',
  onBillingCadenceChange,
  readOnly,
  isUnlimited,
  onUpdateSeats,
  loading,
}: SeatManagementProps) {
  const [targetSeats, setTargetSeats] = useState(currentSeats);
  const [updating, setUpdating] = useState(false);

  const additionalSeats = Math.max(0, targetSeats - seatsIncluded);
  const hasChanges = targetSeats !== currentSeats;
  const canDecrease = targetSeats > seatsUsed;
  const canIncrease = maxSeats === null || targetSeats < maxSeats;
  const seatTotal = useMemo(() => targetSeats * pricePerSeat, [pricePerSeat, targetSeats]);
  const isAnnual = billingCadence === 'annual';
  const canToggleCadence = Boolean(onBillingCadenceChange) && !readOnly;

  const handleDecrease = () => {
    if (canDecrease && !readOnly) {
      setTargetSeats(targetSeats - 1);
    }
  };

  const handleIncrease = () => {
    if (canIncrease && !readOnly) {
      setTargetSeats(targetSeats + 1);
    }
  };

  const handleSave = async () => {
    if (!onUpdateSeats || readOnly) return;
    setUpdating(true);
    try {
      await onUpdateSeats(targetSeats);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    setTargetSeats(currentSeats);
  };

  const handleCadenceChange = (checked: boolean) => {
    if (!canToggleCadence) return;
    onBillingCadenceChange?.(checked ? 'annual' : 'monthly');
  };

  if (isUnlimited) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Unlimited staff members</h4>
            <p className="text-xs text-muted-foreground">
              Your plan includes unlimited staff members
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Staff members</h4>
            <p className="text-xs text-muted-foreground">{pricePerSeatLabel}</p>
            <p className="text-xs text-muted-foreground">
              {seatsIncluded} included in plan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDecrease}
            disabled={!canDecrease || loading || updating || readOnly}
            className="h-8 w-8"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-[32px] text-center text-sm font-semibold">
            {targetSeats}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleIncrease}
            disabled={!canIncrease || loading || updating || readOnly}
            className="h-8 w-8"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Seats {hasChanges ? `${currentSeats} -> ${targetSeats}` : targetSeats}
        </div>
        <div className="text-base font-semibold">
          ${seatTotal.toFixed(0)}/{billingCadenceLabel}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{seatsUsed} of {targetSeats} active</span>
        <span>{seatsIncluded} included</span>
      </div>

      <div className="flex items-center justify-between rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Bill annually</span>
        </div>
        <div className="flex items-center gap-2">
          {isAnnual && (
            <span className="text-[11px] font-semibold text-emerald-700">
              Save 25%
            </span>
          )}
          <Switch
            checked={isAnnual}
            onCheckedChange={handleCadenceChange}
            disabled={!canToggleCadence}
          />
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Staff seat changes are coming soon.</span>
        </div>
      )}

      {/* Cannot decrease warning */}
      {targetSeats <= seatsUsed && seatsUsed > seatsIncluded && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {seatsUsed} active staff members. Remove staff to reduce seats below this number.
          </AlertDescription>
        </Alert>
      )}

      {(hasChanges || readOnly) && additionalSeats > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {seatsIncluded} included • {additionalSeats} additional seat{additionalSeats === 1 ? '' : 's'}
        </div>
      )}

      {/* Action Buttons */}
      {hasChanges && !readOnly && (
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={updating}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updating}
            className="flex-1"
          >
            {updating ? 'Updating...' : 'Confirm seat update'}
          </Button>
        </div>
      )}

      {/* Max seats info */}
      {maxSeats !== null && (
        <p className="text-center text-xs text-muted-foreground">
          Maximum {maxSeats} seats on your current plan.{' '}
          <span className="underline cursor-pointer">Upgrade for more</span>
        </p>
      )}
    </div>
  );
}

export default SeatManagement;
