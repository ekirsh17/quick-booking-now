import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Opening } from '@/types/openings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar, Clock, Phone, User } from 'lucide-react';

interface BookedOpeningModalProps {
  open: boolean;
  onClose: () => void;
  opening: Opening | null;
  staffName?: string | null;
  onApprove?: () => void;
  onReject?: () => void;
  actionLoading?: boolean;
}

export const BookedOpeningModal = ({
  open,
  onClose,
  opening,
  staffName,
  onApprove,
  onReject,
  actionLoading = false,
}: BookedOpeningModalProps) => {
  const isMobile = useIsMobile();
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetHeaderRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef(0);
  const dragLastYRef = useRef(0);
  const dragLastTimeRef = useRef(0);
  const dragVelocityRef = useRef(0);
  const isDragActiveRef = useRef(false);

  if (!opening) return null;

  const parseBookingNotes = (notes?: string | null) => {
    if (!notes) {
      return { customerName: '', customerPhone: '', displayNotes: '' };
    }

    const parts = notes.split('|').map((part) => part.trim()).filter(Boolean);
    let customerName = '';
    let customerPhone = '';
    const remaining: string[] = [];

    for (const part of parts) {
      const [rawKey, ...rest] = part.split(':');
      if (rest.length === 0) {
        remaining.push(part);
        continue;
      }

      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();

      if (key === 'booked_by' || key === 'customer' || key === 'name') {
        customerName = value;
      } else if (key === 'phone' || key === 'phone_number') {
        customerPhone = value;
      } else if (key === 'consumer_id') {
        continue;
      } else {
        remaining.push(part);
      }
    }

    return { customerName, customerPhone, displayNotes: remaining.join(' | ') };
  };

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw.trim();
  };

  const toTelHref = (raw: string) => {
    const cleaned = raw.replace(/[^\d+]/g, '');
    return cleaned.startsWith('+') ? cleaned : cleaned.replace(/\D/g, '');
  };

  const formatDurationShort = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const start = new Date(opening.start_time);
  const end = new Date(opening.end_time);
  const durationLabel = formatDurationShort(opening.duration_minutes);
  const appointmentLabel = opening.appointment_name;
  const parsedNotes = parseBookingNotes(opening.notes);
  const customerName = opening.booked_by_name || parsedNotes.customerName;
  const customerPhone = opening.consumer_phone || parsedNotes.customerPhone;
  const formattedPhone = customerPhone ? formatPhone(customerPhone) : '';
  const phoneHref = customerPhone ? `tel:${toTelHref(customerPhone)}` : '';
  const isPending = opening.status === 'pending_confirmation';
  const statusLabel = isPending ? 'Pending confirmation' : 'Booked';
  const modalTitle = isPending ? 'Booking Request' : 'Booked Opening';
  const displayNotes = parsedNotes.displayNotes;
  const headerSummary = `${format(start, 'EEE, MMM d')} • ${format(start, 'h:mm a')} • ${durationLabel}`;

  const handleSheetTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || event.touches.length !== 1) return;
    if (!sheetHeaderRef.current?.contains(event.target as Node)) return;

    const startY = event.touches[0].clientY;
    isDragActiveRef.current = true;
    setIsDraggingSheet(true);
    dragStartYRef.current = startY;
    dragLastYRef.current = startY;
    dragLastTimeRef.current = performance.now();
    dragVelocityRef.current = 0;
  };

  const handleSheetTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragActiveRef.current || event.touches.length !== 1) return;

    const currentY = event.touches[0].clientY;
    const delta = Math.max(0, currentY - dragStartYRef.current);
    const now = performance.now();
    const dt = Math.max(now - dragLastTimeRef.current, 1);
    dragVelocityRef.current = (currentY - dragLastYRef.current) / dt;
    dragLastYRef.current = currentY;
    dragLastTimeRef.current = now;

    if (delta > 0 && event.cancelable) {
      event.preventDefault();
    }

    setDragOffsetY(delta);
  };

  const handleSheetTouchEnd = () => {
    if (!isDragActiveRef.current) return;
    isDragActiveRef.current = false;
    setIsDraggingSheet(false);

    const shouldDismiss = dragOffsetY > 110 || dragVelocityRef.current > 0.85;
    setDragOffsetY(0);
    if (shouldDismiss) {
      onClose();
    }
  };

  const modalContent = (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Appointment Details</Label>
        <div className="rounded-xl border border-border/60 bg-background px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {format(start, 'EEE, MMM d')}
            </div>
          <div className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {format(start, 'h:mm a')}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {durationLabel}
          </div>
        </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium">Customer</Label>
        <div className="rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={phoneHref} className="font-medium text-primary hover:underline">
              {formattedPhone}
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-2 md:space-y-4">
        {appointmentLabel && (
          <div>
            <Label className="text-sm font-medium">
              Appointment Type <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="mt-2 inline-flex items-center rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground bg-background">
              {appointmentLabel}
            </div>
          </div>
        )}
        {displayNotes && (
          <div>
            <Label htmlFor="booked-notes" className="text-sm font-medium">
              Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="booked-notes"
              value={displayNotes}
              readOnly
              rows={2}
              className="text-sm resize-none min-h-[60px] mt-2"
              aria-label="Notes"
            />
          </div>
        )}
      </div>

      {staffName && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20">
          <span className="text-xs text-muted-foreground">Staff:</span>
          <span className="text-xs font-medium">{staffName}</span>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <SheetContent
          side="bottom"
          className="h-[65vh] p-0 flex flex-col rounded-t-2xl overflow-hidden z-[80]"
          style={{
            transform: `translateY(${dragOffsetY}px)`,
            transition: isDraggingSheet ? 'none' : 'transform 180ms ease-out',
            willChange: 'transform',
          }}
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
        >
          <div ref={sheetHeaderRef}>
            <SheetHeader className="px-4 pt-5 pb-3 border-b border-border bg-background flex-shrink-0">
              <SheetTitle className="text-left">{modalTitle}</SheetTitle>
              {isPending && (
                <p className="text-xs text-muted-foreground text-left mt-1.5">
                  Review and confirm this request.
                </p>
              )}
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {modalContent}
          </div>
          <div className="border-t border-border bg-background flex-shrink-0 pb-safe">
            <div className="p-3">
              {isPending && onApprove && onReject ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onReject}
                      disabled={actionLoading}
                      className="flex-1 min-h-[44px]"
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      onClick={onApprove}
                      disabled={actionLoading}
                      className="flex-1 min-h-[44px]"
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="w-full min-h-[44px]"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-w-[95vw] p-0 gap-0 flex max-h-[85vh] min-h-0 flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-8 pb-5 border-b border-border">
          <div>
            <DialogTitle className="text-left text-lg">{modalTitle}</DialogTitle>
            {isPending && (
              <p className="text-xs text-muted-foreground text-left mt-1.5">
                Review and confirm this request.
              </p>
            )}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {modalContent}
        </div>
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
          <div className="flex items-center justify-end w-full gap-3">
            {isPending && onApprove && onReject ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReject}
                  disabled={actionLoading}
                  className="sm:min-w-[110px] min-h-[44px]"
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={onApprove}
                  disabled={actionLoading}
                  className="sm:min-w-[110px] min-h-[44px]"
                >
                  Approve
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="sm:min-w-[90px] min-h-[44px]"
              >
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
