import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, setHours, setMinutes, addMinutes } from 'date-fns';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Send } from 'lucide-react';
import { AppointmentTypePills } from './AppointmentTypePills';
import { DateTimeDurationRow } from './DateTimeDurationRow';
import { useAppointmentPresets } from '@/hooks/useAppointmentPresets';
import { useDurationPresets } from '@/hooks/useDurationPresets';
import { Opening, WorkingHours, Staff } from '@/types/openings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface OpeningModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: OpeningFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  opening?: Opening | null;
  defaultDate?: Date;
  defaultTime?: Date;
  defaultDuration?: number;
  workingHours: WorkingHours;
  primaryStaff: Staff | null;
  staffOptions: Staff[];
  checkConflict: (startTime: string, endTime: string, openingId?: string) => Promise<boolean>;
  savedDurations?: number[];
  profileDefaultDuration?: number;
}

type ModalMode = 'edit' | 'confirm-delete';

export interface OpeningFormData {
  date: Date;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_name: string;
  notes?: string;
  publish_now?: boolean;
  staff_id?: string | null;
}

export const OpeningModal = ({
  open,
  onClose,
  onSave,
  onDelete,
  opening,
  defaultDate,
  defaultTime,
  defaultDuration,
  workingHours,
  primaryStaff,
  staffOptions,
  checkConflict,
  savedDurations = [],
  profileDefaultDuration,
}: OpeningModalProps) => {
  const { user } = useAuth();
  const { presets } = useAppointmentPresets(user?.id);
  const { presets: durationPresets } = useDurationPresets(user?.id);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date>(defaultDate || new Date());
  const [startHour, setStartHour] = useState('9');
  const [startMinute, setStartMinute] = useState('00');
  const [isAM, setIsAM] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [appointmentName, setAppointmentName] = useState('');
  const [notes, setNotes] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [outsideWorkingHours, setOutsideWorkingHours] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('edit');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(primaryStaff?.id || null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetHeaderRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef(0);
  const dragLastYRef = useRef(0);
  const dragLastTimeRef = useRef(0);
  const dragVelocityRef = useRef(0);
  const isDragActiveRef = useRef(false);
  const hasMultipleStaff = staffOptions.length > 1;
  const resolvedStaffName = useMemo(() => {
    if (selectedStaffId) {
      return staffOptions.find((staff) => staff.id === selectedStaffId)?.name || null;
    }
    if (primaryStaff?.name) {
      return primaryStaff.name;
    }
    return staffOptions[0]?.name || null;
  }, [primaryStaff, selectedStaffId, staffOptions]);
  
  // Calculate total duration
  const duration = durationMinutes;

  const applySnappedStartTime = useCallback((source: Date) => {
    const rawHours = source.getHours();
    const rawMinutes = source.getMinutes();
    // Snap to nearest 15-min increment — picker only supports 15-min steps
    const roundedQuarter = Math.round(rawMinutes / 15) * 15;
    const snappedMinutes = roundedQuarter % 60;
    const minuteOverflow = roundedQuarter >= 60;
    const adjustedHours24 = (rawHours + (minuteOverflow ? 1 : 0)) % 24;
    const displayHours = adjustedHours24 === 0 ? 12 : adjustedHours24 > 12 ? adjustedHours24 - 12 : adjustedHours24;

    setIsAM(adjustedHours24 < 12);
    setStartHour(displayHours.toString());
    setStartMinute(snappedMinutes.toString().padStart(2, '0'));
  }, []);

  // Initialize form with opening data or defaults
  useEffect(() => {
    if (opening) {
      const start = new Date(opening.start_time);
      setDate(start);
      applySnappedStartTime(start);
      
      // Set duration
      setDurationMinutes(opening.duration_minutes);
      
      setAppointmentName(opening.appointment_name || '');
      setNotes(opening.notes || '');
    } else if (defaultDate) {
      setDate(defaultDate);
      if (defaultTime) {
        applySnappedStartTime(defaultTime);
      }
      // Always set duration - use defaultDuration if provided, otherwise use profile default
      const defaultDur = defaultDuration !== undefined ? defaultDuration : (profileDefaultDuration || 30);
      setDurationMinutes(defaultDur);
    }
  }, [opening, defaultDate, defaultTime, defaultDuration, profileDefaultDuration, applySnappedStartTime]);


  // Calculate end time with AM/PM conversion
  const get24HourTime = (hour: string, minute: string, am: boolean) => {
    let hour24 = parseInt(hour);
    const minutes = parseInt(minute);
    if (!am && hour24 !== 12) hour24 = hour24 + 12;
    if (am && hour24 === 12) hour24 = 0;
    return { hours: hour24, minutes };
  };

  const { hours: startHour24, minutes: startMinutes } = get24HourTime(startHour, startMinute, isAM);
  
  const endTime = format(
    addMinutes(
      setMinutes(setHours(date, startHour24), startMinutes),
      duration
    ),
    'h:mm a'
  );

  // Check working hours
  useEffect(() => {
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];
    
    if (!dayHours?.enabled) {
      setOutsideWorkingHours(true);
      return;
    }

    const { hours: startHour24 } = get24HourTime(startHour, startMinute, isAM);
    const workingStart = parseInt(dayHours.start.split(':')[0]);
    const workingEnd = parseInt(dayHours.end.split(':')[0]);
    
    const isOutside = startHour24 < workingStart || startHour24 >= workingEnd;
    setOutsideWorkingHours(isOutside);
  }, [date, startHour, startMinute, isAM, workingHours]);

  useEffect(() => {
    if (opening?.staff_id) {
      setSelectedStaffId(opening.staff_id);
      return;
    }
    if (hasMultipleStaff) {
      setSelectedStaffId('any');
      return;
    }
    if (primaryStaff?.id) {
      setSelectedStaffId(primaryStaff.id);
      return;
    }
    if (staffOptions.length > 0) {
      setSelectedStaffId(staffOptions[0].id);
      return;
    }
    setSelectedStaffId(null);
  }, [opening, primaryStaff, staffOptions, hasMultipleStaff]);

  const handleSave = async (publish: boolean = false) => {
    try {
      setLoading(true);
      const { hours: startHour24, minutes: startMinutes } = get24HourTime(startHour, startMinute, isAM);
      const startDateTime = setMinutes(setHours(date, startHour24), startMinutes);
      const endDateTime = addMinutes(startDateTime, duration);
      const resolvedStaffId = selectedStaffId === 'any'
        ? null
        : selectedStaffId || primaryStaff?.id || staffOptions[0]?.id || null;
      await onSave({
        date,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration_minutes: duration,
        appointment_name: appointmentName,
        notes,
        publish_now: publish,
        staff_id: resolvedStaffId,
      });

      setIsDirty(false);
      onClose();
    } catch (error) {
      console.error('Error saving opening:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    if (modalMode === 'confirm-delete') {
      setModalMode('edit');
      return;
    }

    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    setIsDirty(false);
    onClose();
  }, [isDirty, modalMode, onClose]);

  const handleDelete = async () => {
    if (!onDelete) return;
    
    try {
      setLoading(true);
      await onDelete();
      setModalMode('edit');
      setIsDirty(false);
      onClose();
    } catch (error) {
      console.error('Error deleting opening:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateDurationInput = (input: string): { valid: boolean; message?: string } => {
    const cleaned = input.toLowerCase().trim();
    
    if (!/^[\d\s.hminoute]+$/.test(cleaned)) {
      return { valid: false, message: "Use format: 90, 1.5h, or 2h 30m" };
    }
    
    const parsed = parseDurationInput(input);
    if (parsed === 0) return { valid: false, message: "Invalid format" };
    if (parsed < 5) return { valid: false, message: "Minimum 5 minutes" };
    if (parsed > 480) return { valid: false, message: "Maximum 8 hours" };
    
    return { valid: true };
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = minutes / 60;
    if (Number.isInteger(hours)) {
      return `${hours}h`;
    }
    // Always show 2 decimal places for non-integer hours
    return `${hours.toFixed(2)}h`;
  };

  const parseDurationInput = (input: string): number => {
    if (!input) return 0;
    
    const cleaned = input.toLowerCase().trim();
    
    // Handle pure number (assumed minutes)
    if (/^\d+$/.test(cleaned)) {
      return parseInt(cleaned);
    }
    
    // Handle decimal hours (e.g., "1.5")
    if (/^\d+\.\d+$/.test(cleaned)) {
      return Math.round(parseFloat(cleaned) * 60);
    }
    
    // Handle formats like "1h", "1.5h", "90m", "1h 30m", "2 hours 30 minutes"
    let totalMinutes = 0;
    
    const hourMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/);
    if (hourMatch) {
      totalMinutes += parseFloat(hourMatch[1]) * 60;
    }
    
    const minuteMatch = cleaned.match(/(\d+)\s*m(?:in)?(?:ute)?s?/);
    if (minuteMatch) {
      totalMinutes += parseInt(minuteMatch[1]);
    }
    
    return Math.round(totalMinutes);
  };


  const handleSaveDuration = async (value: string) => {
    if (!user) return;
    
    const parsed = parseDurationInput(value);
    const validation = validateDurationInput(value);
    
    if (!validation.valid || parsed === 0) {
      toast({
        title: "Invalid duration",
        description: validation.message || "Please enter a valid duration",
        variant: "destructive"
      });
      return;
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('saved_durations')
      .eq('id', user.id)
      .single();
    
    const currentDurations = (profile?.saved_durations || []) as number[];
    
    if (currentDurations.length >= 10) {
      toast({
        title: "Limit reached",
        description: "You can save up to 10 custom durations. Delete some from Settings to add more.",
        variant: "destructive"
      });
      return;
    }
    
    if (!currentDurations.includes(parsed)) {
      const updatedDurations = [...currentDurations, parsed].sort((a, b) => a - b);
      
      await supabase
        .from('profiles')
        .update({ saved_durations: updatedDurations })
        .eq('id', user.id);
      
      setDurationMinutes(parsed);
      
      toast({
        title: "Duration saved",
        description: `${formatDuration(parsed)} added to your presets.`,
      });
    } else {
      setDurationMinutes(parsed);
    }
  };

  // Track changes for dirty state
  useEffect(() => {
    if (open && !opening) {
      setIsDirty(false);
      setShowCustomDuration(false);
      setCustomDurationInput('');
    }
    if (open) {
      setModalMode('edit');
    }
  }, [open, opening]);

  const deleteSummary = useMemo(() => {
    if (!opening) return null;
    return {
      title: opening.appointment_name || 'Opening',
      date: format(new Date(opening.start_time), 'EEEE, MMM d'),
      timeRange: `${format(new Date(opening.start_time), 'h:mm a')} - ${format(new Date(opening.end_time), 'h:mm a')}`,
    };
  }, [opening]);

  const handleSetToday = () => {
    setDate(new Date());
    setIsDirty(true);
  };

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
      handleClose();
    }
  };

  const modalContent = (
    <div className="space-y-3 md:space-y-6">
      {/* Date, Time & Duration Row */}
      <DateTimeDurationRow
        date={date}
        onDateChange={(d) => { setDate(d); setIsDirty(true); }}
        startHour={startHour}
        startMinute={startMinute}
        isAM={isAM}
        onStartHourChange={(h) => { setStartHour(h); setIsDirty(true); }}
        onStartMinuteChange={(m) => { setStartMinute(m); setIsDirty(true); }}
        onAMPMChange={(am) => { setIsAM(am); setIsDirty(true); }}
        durationMinutes={durationMinutes}
        onDurationChange={(m) => { setDurationMinutes(m); setIsDirty(true); }}
        durationPresets={durationPresets}
        endTime={endTime}
        outsideWorkingHours={outsideWorkingHours}
      />

      {staffOptions.length > 1 && (
        <div className="space-y-1 relative z-[60]">
          <Label className="text-sm font-medium">Staff member</Label>
          <Select
            value={selectedStaffId || undefined}
            onValueChange={(value) => {
              setSelectedStaffId(value);
              setIsDirty(true);
            }}
            modal={false}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select staff" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="any">Any staff</SelectItem>
              {staffOptions.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Appointment Type & Notes */}
      <div className="space-y-2 md:space-y-4">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">
            Appointment Type <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <AppointmentTypePills
            showLabel={false}
            value={appointmentName}
            onChange={(value) => {
              setAppointmentName(value);
              setIsDirty(true);
            }}
            presets={presets.map(p => ({
              id: p.id,
              label: p.label,
              color_token: p.color_token,
              position: p.position,
            }))}
            maxVisiblePills={6}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes" className="text-sm font-medium">
            Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
            placeholder="Add any notes..."
            rows={2}
            maxLength={120}
            className="text-sm resize-none min-h-[60px]"
            aria-label="Notes"
          />
          {notes.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/120
            </p>
          )}
        </div>
      </div>

    </div>
  );

  const deleteConfirmContent = (
    <div className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground">
        This action cannot be undone.
      </p>
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {deleteSummary?.title || 'Opening'}
        </p>
        {deleteSummary && (
          <>
            <p className="text-sm text-muted-foreground">{deleteSummary.date}</p>
            <p className="text-sm text-muted-foreground">{deleteSummary.timeRange}</p>
          </>
        )}
        {resolvedStaffName && (
          <p className="text-sm text-muted-foreground">
            Staff: <span className="font-medium text-foreground">{resolvedStaffName}</span>
          </p>
        )}
      </div>
    </div>
  );

  const isDeleteConfirmMode = modalMode === 'confirm-delete';
  const canDeleteOpening = Boolean(opening && onDelete);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          className="h-[85vh] p-0 flex flex-col rounded-t-2xl overflow-hidden z-[80]"
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
              <SheetTitle className="text-left">
                {isDeleteConfirmMode ? 'Delete this opening?' : opening ? 'Edit Opening' : 'Add Opening'}
              </SheetTitle>
              <p className="text-xs text-muted-foreground text-left mt-1.5">
                {isDeleteConfirmMode
                  ? 'Confirm deletion to permanently remove this opening.'
                  : publishNow
                    ? 'Send a text to everyone waiting for an opening'
                    : 'Save as draft'}
              </p>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {isDeleteConfirmMode ? deleteConfirmContent : modalContent}
          </div>
          {!isDeleteConfirmMode && staffOptions.length <= 1 && resolvedStaffName && (
            <div className="px-3 pb-2 text-xs text-muted-foreground">
              Staff: <span className="font-medium text-foreground">{resolvedStaffName}</span>
            </div>
          )}
          <div className="border-t border-border bg-background flex-shrink-0 pb-safe">
            <div className="p-3">
              {isDeleteConfirmMode ? (
                <div className="flex gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalMode('edit')}
                    disabled={loading}
                    className="flex-1 min-h-[44px]"
                  >
                    Keep opening
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 min-h-[44px]"
                  >
                    {loading ? 'Deleting...' : 'Delete opening'}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 w-full">
                  {canDeleteOpening && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setModalMode('confirm-delete')}
                      disabled={loading}
                      className="min-h-[44px] !border-red-500 !text-red-600 hover:!border-red-600 hover:!bg-red-50 hover:!text-red-700 dark:!border-red-700 dark:!text-red-300 dark:hover:!border-red-600 dark:hover:!bg-red-950/30 dark:hover:!text-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSave(publishNow)}
                    disabled={loading}
                    className="flex-1 min-h-[44px] font-medium"
                  >
                    {loading ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Publish Opening
                      </>
                    )}
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] p-0 gap-0 flex max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-8 pb-5 border-b border-border">
          <div className="flex items-start justify-between pr-6">
            <div>
              <DialogTitle className="text-left text-lg">
                {isDeleteConfirmMode ? 'Delete this opening?' : opening ? 'Edit Opening' : 'Add Opening'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground text-left mt-1.5">
                {isDeleteConfirmMode
                  ? 'Confirm deletion to permanently remove this opening.'
                  : publishNow
                    ? 'Send a text to everyone waiting for an opening'
                    : 'Save as draft'}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          {isDeleteConfirmMode ? deleteConfirmContent : modalContent}
        </div>
        {!isDeleteConfirmMode && staffOptions.length <= 1 && resolvedStaffName && (
          <div className="px-6 pb-2 text-xs text-muted-foreground">
            Staff: <span className="font-medium text-foreground">{resolvedStaffName}</span>
          </div>
        )}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
          {isDeleteConfirmMode ? (
            <div className="flex gap-2 w-full sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalMode('edit')}
                disabled={loading}
                className="flex-1 sm:flex-initial sm:min-w-[120px] min-h-[44px]"
              >
                Keep opening
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px]"
              >
                {loading ? 'Deleting...' : 'Delete opening'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full sm:justify-end">
              {canDeleteOpening && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalMode('confirm-delete')}
                  disabled={loading}
                  className="sm:mr-auto min-h-[44px] !border-red-500 !text-red-600 hover:!border-red-600 hover:!bg-red-50 hover:!text-red-700 dark:!border-red-700 dark:!text-red-300 dark:hover:!border-red-600 dark:hover:!bg-red-950/30 dark:hover:!text-red-200"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 sm:flex-initial sm:min-w-[90px] min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSave(publishNow)}
                disabled={loading}
                className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px] font-medium"
              >
                {loading ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Publish Opening
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
