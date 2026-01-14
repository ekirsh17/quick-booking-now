import { useState, useEffect, useCallback } from 'react';
import { format, setHours, setMinutes, addMinutes } from 'date-fns';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Send } from 'lucide-react';
import { AppointmentTypePills } from './AppointmentTypePills';
import { DateTimeDurationRow } from './DateTimeDurationRow';
import { useAppointmentPresets } from '@/hooks/useAppointmentPresets';
import { useDurationPresets } from '@/hooks/useDurationPresets';
import { cn } from '@/lib/utils';
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
  checkConflict: (startTime: string, endTime: string, openingId?: string) => Promise<boolean>;
  savedDurations?: number[];
  profileDefaultDuration?: number;
}

export interface OpeningFormData {
  date: Date;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_name: string;
  notes?: string;
  publish_now?: boolean;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Calculate total duration
  const duration = durationMinutes;

  // Initialize form with opening data or defaults
  useEffect(() => {
    if (opening) {
      const start = new Date(opening.start_time);
      setDate(start);
      const hours = start.getHours();
      const minutes = start.getMinutes();
      setIsAM(hours < 12);
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      setStartHour(displayHours.toString());
      setStartMinute(minutes.toString().padStart(2, '0'));
      
      // Set duration
      setDurationMinutes(opening.duration_minutes);
      
      setAppointmentName(opening.appointment_name || '');
      setNotes(opening.notes || '');
    } else if (defaultDate) {
      setDate(defaultDate);
      if (defaultTime) {
        const hours = defaultTime.getHours();
        const minutes = defaultTime.getMinutes();
        setIsAM(hours < 12);
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        setStartHour(displayHours.toString());
        setStartMinute(minutes.toString().padStart(2, '0'));
      }
      // Always set duration - use defaultDuration if provided, otherwise use profile default
      const defaultDur = defaultDuration !== undefined ? defaultDuration : (profileDefaultDuration || 30);
      setDurationMinutes(defaultDur);
    }
  }, [opening, defaultDate, defaultTime, defaultDuration, profileDefaultDuration]);

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

  const handleSave = async (publish: boolean = false) => {
    try {
      setLoading(true);
      const { hours: startHour24, minutes: startMinutes } = get24HourTime(startHour, startMinute, isAM);
      const startDateTime = setMinutes(setHours(date, startHour24), startMinutes);
      const endDateTime = addMinutes(startDateTime, duration);

      await onSave({
        date,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration_minutes: duration,
        appointment_name: appointmentName,
        notes,
        publish_now: publish,
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
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    setIsDirty(false);
    onClose();
  }, [isDirty, onClose]);

  const handleDelete = async () => {
    if (!onDelete) return;
    
    try {
      setLoading(true);
      await onDelete();
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
  }, [open, opening]);

  const handleSetToday = () => {
    setDate(new Date());
    setIsDirty(true);
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

      {/* Settings section */}
      {primaryStaff && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20">
          <span className="text-xs text-muted-foreground">Staff:</span>
          <span className="text-xs font-medium">{primaryStaff.name}</span>
        </div>
      )}
    </div>
  );


  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={handleClose}>
          <SheetContent 
            side="bottom" 
            className="h-[85vh] p-0 flex flex-col rounded-t-2xl z-[80]"
          >
            <SheetHeader className="px-4 pt-5 pb-3 border-b border-border bg-background flex-shrink-0">
              <div>
                <SheetTitle className="text-left">
                  {opening ? 'Edit Opening' : 'Add Opening'}
                </SheetTitle>
                <p className="text-xs text-muted-foreground text-left mt-1.5">
                  {publishNow ? 'Send a text to everyone waiting for an opening' : 'Save as draft'}
                </p>
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {modalContent}
            </div>
            <div className="border-t border-border bg-background flex-shrink-0 pb-safe">
              <div className="p-3">
                <div className="flex gap-2 w-full">
                  {opening && onDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={loading}
                      className="min-h-[44px] border-destructive/30 text-destructive hover:bg-destructive/10"
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
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Opening</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this opening? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-w-[95vw] p-0 gap-0 flex flex-col max-h-[86vh]">
          <DialogHeader className="px-6 pt-8 pb-5 border-b border-border">
            <div className="flex items-start justify-between pr-6">
              <div>
                <DialogTitle className="text-left text-lg">
                  {opening ? 'Edit Opening' : 'Add Opening'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground text-left mt-1.5">
                  {publishNow ? 'Send a text to everyone waiting for an opening' : 'Save as draft'}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {modalContent}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border bg-background">
            <div className="flex gap-2 w-full sm:justify-end">
              {opening && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="sm:mr-auto min-h-[44px] border-destructive/30 text-destructive hover:bg-destructive/10"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Opening</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this opening? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
