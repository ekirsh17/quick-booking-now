import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Users, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export type SeatUpdateStatus = 'applied' | 'pending_payment' | 'noop';

export interface SeatUpdateResponse {
  status: SeatUpdateStatus;
  seatCountRequested: number;
  seatCountEffective: number;
  seatCountPending?: number;
  invoiceId?: string;
  nextActionUrl?: string;
  message?: string;
}

type SeatUiState = 'idle' | 'dirty' | 'saving' | 'pending_payment' | 'error';

interface SeatManagementProps {
  currentSeats: number;
  seatsUsed: number;
  maxSeats: number | null;
  pricePerSeat: number;
  billingCadence?: 'monthly' | 'annual';
  readOnly?: boolean;
  isUnlimited: boolean;
  onUpdateSeats?: (newCount: number) => Promise<SeatUpdateResponse>;
  onManagePayment?: () => void;
  loading?: boolean;
}

export function SeatManagement({
  currentSeats,
  seatsUsed,
  maxSeats,
  pricePerSeat,
  billingCadence = 'monthly',
  readOnly = false,
  isUnlimited,
  onUpdateSeats,
  onManagePayment,
  loading,
}: SeatManagementProps) {
  const [targetSeats, setTargetSeats] = useState(currentSeats);
  const [uiState, setUiState] = useState<SeatUiState>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingSeatCount, setPendingSeatCount] = useState<number | null>(null);
  const [pendingActionUrl, setPendingActionUrl] = useState<string | null>(null);
  const minSeatsAllowed = Math.max(1, seatsUsed);

  useEffect(() => {
    setTargetSeats(currentSeats);
    setUiState('idle');
    setFeedback(null);
    setPendingSeatCount(null);
    setPendingActionUrl(null);
  }, [currentSeats]);

  const currentMonthlyTotal = useMemo(() => currentSeats * pricePerSeat, [currentSeats, pricePerSeat]);
  const draftMonthlyTotal = useMemo(() => targetSeats * pricePerSeat, [pricePerSeat, targetSeats]);
  const hasChanges = targetSeats !== currentSeats;
  const canDecrease = targetSeats > minSeatsAllowed;
  const canIncrease = maxSeats === null || targetSeats < maxSeats;
  const currentSeatsAvailable = currentSeats - seatsUsed;
  const isAtLimit = seatsUsed === currentSeats;
  const usagePercent = currentSeats > 0
    ? Math.min((seatsUsed / currentSeats) * 100, 100)
    : 0;
  const currentMonthlyEquivalent = billingCadence === 'annual' ? currentMonthlyTotal / 12 : currentMonthlyTotal;
  const draftMonthlyEquivalent = billingCadence === 'annual' ? draftMonthlyTotal / 12 : draftMonthlyTotal;

  const handleSeatChange = (next: number) => {
    if (readOnly || uiState === 'saving') return;
    const clampedLower = Math.max(minSeatsAllowed, next);
    const clamped = maxSeats === null ? clampedLower : Math.min(maxSeats, clampedLower);
    setTargetSeats(clamped);
    setUiState(clamped === currentSeats ? 'idle' : 'dirty');
    setFeedback(null);
    setPendingSeatCount(null);
    setPendingActionUrl(null);
  };

  const handleCancel = () => {
    setTargetSeats(currentSeats);
    setUiState('idle');
    setFeedback(null);
    setPendingSeatCount(null);
    setPendingActionUrl(null);
  };

  const handleOpenPendingAction = () => {
    if (!pendingActionUrl) return;
    window.location.assign(pendingActionUrl);
  };

  const handleSave = async () => {
    if (!onUpdateSeats || readOnly || !hasChanges) return;

    setUiState('saving');
    setFeedback(null);
    setPendingSeatCount(null);
    setPendingActionUrl(null);

    try {
      const result = await onUpdateSeats(targetSeats);
      if (result.status === 'applied') {
        setUiState('idle');
        setFeedback(null);
        return;
      }

      if (result.status === 'pending_payment') {
        setUiState('pending_payment');
        setTargetSeats(result.seatCountEffective);
        setPendingSeatCount(result.seatCountPending ?? result.seatCountRequested);
        setPendingActionUrl(result.nextActionUrl || null);
        setFeedback(result.message || 'Payment confirmation is required before this seat increase can be applied.');
        return;
      }

      setUiState('idle');
      setTargetSeats(result.seatCountEffective);
      setFeedback(result.message || null);
    } catch (error) {
      setUiState('error');
      setTargetSeats(currentSeats);
      setPendingSeatCount(null);
      setPendingActionUrl(null);
      setFeedback(error instanceof Error ? error.message : 'Unable to update seats right now.');
    }
  };

  if (isUnlimited) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Unlimited staff seats</p>
            <p className="text-xs text-muted-foreground">Your current plan includes unlimited staff members.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5 sm:p-6">
      <div>
        <p className="text-2xl font-semibold tracking-tight">${currentMonthlyEquivalent.toFixed(0)}/mo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentSeats} seat{currentSeats === 1 ? '' : 's'} at ${pricePerSeat.toFixed(0)}/seat • billed {billingCadence}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div className="flex-1">
          <p className="text-sm font-semibold leading-none">Staff seats</p>
          <p className="mt-1 text-xs text-muted-foreground">Each active staff member uses one seat.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => handleSeatChange(targetSeats - 1)}
            disabled={!canDecrease || loading || uiState === 'saving' || readOnly}
            aria-label="Decrease staff seats"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-[32px] text-center text-sm font-semibold">{targetSeats}</div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => handleSeatChange(targetSeats + 1)}
            disabled={!canIncrease || loading || uiState === 'saving' || readOnly}
            aria-label="Increase staff seats"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Coverage usage</span>
          <span>{seatsUsed} of {currentSeats} seats used</span>
        </div>
        <Progress value={usagePercent} className="h-2" />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-muted-foreground">
          {isAtLimit
            ? 'All seats are in use. Add a seat before inviting another active staff member.'
            : `${currentSeatsAvailable} open seat${currentSeatsAvailable === 1 ? '' : 's'} available.`}
        </p>
      </div>

      {uiState === 'pending_payment' && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>{feedback || 'Payment confirmation is required before this seat increase can be applied.'}</p>
            {pendingSeatCount && (
              <p className="text-xs">
                Pending update: {pendingSeatCount} seats requested. Current plan remains at {currentSeats} until payment confirms.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {pendingActionUrl && (
                <Button size="sm" onClick={handleOpenPendingAction}>
                  Complete payment
                </Button>
              )}
              {onManagePayment && (
                <Button size="sm" variant="outline" onClick={onManagePayment}>
                  Update payment method
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {uiState === 'error' && feedback && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      {readOnly && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Seat updates are disabled for this subscription.</span>
        </div>
      )}

      {hasChanges && !readOnly && uiState !== 'pending_payment' && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Pending update: {targetSeats} seat{targetSeats === 1 ? '' : 's'} · ${draftMonthlyEquivalent.toFixed(0)}/mo
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={uiState === 'saving'}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={uiState === 'saving'}
              className="flex-1"
            >
              {uiState === 'saving' ? 'Updating...' : 'Update seats'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeatManagement;
