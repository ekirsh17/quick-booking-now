import { useMemo, useState } from 'react';
import { Plus, Minus, Users, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface SeatManagementProps {
  currentSeats: number;
  seatsUsed: number;
  seatsIncluded: number;
  maxSeats: number | null;
  pricePerSeat: number;
  pricePerSeatLabel: string;
  billingCadenceLabel: string;
  trialing?: boolean;
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
  trialing,
  readOnly,
  isUnlimited,
  onUpdateSeats,
  loading,
}: SeatManagementProps) {
  const [targetSeats, setTargetSeats] = useState(currentSeats);
  const [updating, setUpdating] = useState(false);

  const additionalSeats = Math.max(0, targetSeats - seatsIncluded);
  const additionalCost = additionalSeats * pricePerSeat;
  const hasChanges = targetSeats !== currentSeats;
  const canDecrease = targetSeats > seatsUsed;
  const canIncrease = maxSeats === null || targetSeats < maxSeats;
  const seatTotal = useMemo(() => targetSeats * pricePerSeat, [pricePerSeat, targetSeats]);

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

  if (isUnlimited) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="font-medium">Unlimited staff members</h4>
            <p className="text-sm text-muted-foreground">
              Your plan includes unlimited staff members
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="font-medium">Staff members</h4>
            <p className="text-sm text-muted-foreground">
              {seatsIncluded} included • {pricePerSeatLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Seat Counter */}
      <div className="flex items-center justify-center gap-4 py-4">
        <Button
          variant="outline"
          size="icon"
          onClick={handleDecrease}
          disabled={!canDecrease || loading || updating || readOnly}
          className="h-10 w-10"
        >
          <Minus className="h-4 w-4" />
        </Button>
        
        <div className="text-center min-w-[100px]">
          <div className="text-4xl font-bold">{targetSeats}</div>
          <div className="text-sm text-muted-foreground">
            {targetSeats === 1 ? 'member' : 'members'}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleIncrease}
          disabled={!canIncrease || loading || updating || readOnly}
          className="h-10 w-10"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Usage indicator */}
      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
        <span>{seatsUsed} of {targetSeats} members active</span>
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

      {/* Cost Preview */}
      {(hasChanges || readOnly) && (
        <div 
          className={cn(
            'rounded-lg p-4 text-center',
            additionalCost > 0 
              ? 'bg-purple-50 dark:bg-purple-900/20'
              : 'bg-emerald-50 dark:bg-emerald-900/20'
          )}
        >
          <div className="text-xs text-muted-foreground">
            Members: {currentSeats} {'->'} {targetSeats}
          </div>
          <div className={cn(
            'text-sm',
            additionalCost > 0
              ? 'text-purple-700 dark:text-purple-300'
              : 'text-emerald-700 dark:text-emerald-300'
          )}>
            {trialing
              ? 'After your trial ends, your subscription will be'
              : 'Your subscription is'}
          </div>
          <div className={cn(
            'text-2xl font-bold',
            additionalCost > 0
              ? 'text-purple-800 dark:text-purple-200'
              : 'text-emerald-800 dark:text-emerald-200'
          )}>
            ${seatTotal.toFixed(2)}/{billingCadenceLabel}
          </div>
          {additionalSeats > 0 && (
            <div className="text-xs text-purple-600 dark:text-purple-400">
              {seatsIncluded} included • {additionalSeats} additional
            </div>
          )}
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


