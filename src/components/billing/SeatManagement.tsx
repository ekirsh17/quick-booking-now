import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Users, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

type SeatUiState = 'idle' | 'dirty' | 'saving' | 'applied' | 'pending_payment' | 'error';

interface SeatManagementProps {
  currentSeats: number;
  seatsUsed: number;
  seatsIncluded: number;
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
  seatsIncluded,
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

  useEffect(() => {
    setTargetSeats(currentSeats);
    setUiState('idle');
    setFeedback(null);
    setPendingSeatCount(null);
    setPendingActionUrl(null);
  }, [currentSeats]);

  const seatTotal = useMemo(() => targetSeats * pricePerSeat, [pricePerSeat, targetSeats]);
  const minSeatsAllowed = Math.max(1, seatsUsed);
  const hasChanges = targetSeats !== currentSeats;
  const canDecrease = targetSeats > minSeatsAllowed;
  const canIncrease = maxSeats === null || targetSeats < maxSeats;
  const additionalSeats = Math.max(0, targetSeats - seatsIncluded);
  const monthlyEquivalent = billingCadence === 'annual' ? seatTotal / 12 : seatTotal;

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
        setUiState('applied');
        setFeedback(result.message || 'Seat count updated.');
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
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div>
        <p className="text-2xl font-semibold tracking-tight">${monthlyEquivalent.toFixed(0)}/mo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {targetSeats} seat{targetSeats === 1 ? '' : 's'} • billed {billingCadence}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div className="flex-1">
          <p className="text-sm font-semibold leading-none">Staff seats</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
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
            className="h-8 w-8"
            onClick={() => handleSeatChange(targetSeats + 1)}
            disabled={!canIncrease || loading || uiState === 'saving' || readOnly}
            aria-label="Increase staff seats"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {uiState === 'applied' && feedback && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

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
        <div className="flex gap-2 pt-1">
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
            {uiState === 'saving' ? 'Updating...' : 'Confirm'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default SeatManagement;
