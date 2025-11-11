import { useState, useEffect, useCallback } from 'react';
import { format, setHours, setMinutes, addMinutes, addDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Combobox } from '@/components/ui/combobox';
import { AlertCircle, Calendar as CalendarIcon, Trash2, Bell, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Opening, WorkingHours, Staff } from '@/types/openings';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
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
  savedAppointmentNames?: string[];
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

const DURATION_PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
];

const HOURS = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: (i + 1).toString(),
}));

const MINUTES = [
  { value: '00', label: '00' },
  { value: '05', label: '05' },
  { value: '10', label: '10' },
  { value: '15', label: '15' },
  { value: '20', label: '20' },
  { value: '25', label: '25' },
  { value: '30', label: '30' },
  { value: '35', label: '35' },
  { value: '40', label: '40' },
  { value: '45', label: '45' },
  { value: '50', label: '50' },
  { value: '55', label: '55' },
];

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
  savedAppointmentNames = [],
  savedDurations = [],
  profileDefaultDuration,
}: OpeningModalProps) => {
  const { user } = useAuth();
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
  const [localSavedNames, setLocalSavedNames] = useState<string[]>(savedAppointmentNames);
  const [isDirty, setIsDirty] = useState(false);
  
  // Sync local saved names with prop changes
  useEffect(() => {
    setLocalSavedNames(savedAppointmentNames);
  }, [savedAppointmentNames]);
  
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
      setNotes('');
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

  const handleSaveAppointmentType = async (value: string) => {
    if (!value.trim() || !user) return;
    
    const trimmedValue = value.trim();
    
    // Check if already saved
    if (localSavedNames.includes(trimmedValue)) {
      setAppointmentName(trimmedValue);
      return;
    }
    
    const updatedNames = [...localSavedNames, trimmedValue];
    
    const { error } = await supabase
      .from('profiles')
      .update({ saved_appointment_names: updatedNames })
      .eq('id', user.id);
    
    if (!error) {
      setLocalSavedNames(updatedNames);
      setAppointmentName(trimmedValue);
      toast({
        title: "Appointment type saved",
        description: `"${trimmedValue}" has been added to your presets.`,
      });
    }
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

  const handleSetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow);
    setIsDirty(true);
  };

  const modalContent = (
    <div className="space-y-4">
          {/* Date Quick Actions */}
          <div className="space-y-2">
            <Label>Date</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSetToday}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg border transition-all min-h-[44px]",
                  format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetTomorrow}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg border transition-all min-h-[44px]",
                  format(date, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd')
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                Tomorrow
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-left font-normal min-h-[44px]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { if (d) { setDate(d); setIsDirty(true); } }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Time Section */}
          <div className="space-y-1.5">

            <Label>Start Time</Label>
            <div className="flex gap-2">
              <select
                value={startHour}
                onChange={(e) => { setStartHour(e.target.value); setIsDirty(true); }}
                className="flex-1 min-w-0 h-11 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Hour"
              >
                {HOURS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              <span className="flex items-center text-muted-foreground">:</span>
              <select
                value={startMinute}
                onChange={(e) => { setStartMinute(e.target.value); setIsDirty(true); }}
                className="flex-1 min-w-0 h-11 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Minute"
              >
                {MINUTES.map((minute) => (
                  <option key={minute.value} value={minute.value}>
                    {minute.label}
                  </option>
                ))}
              </select>
              <select
                value={isAM ? 'AM' : 'PM'}
                onChange={(e) => { setIsAM(e.target.value === 'AM'); setIsDirty(true); }}
                className="flex-1 min-w-0 h-11 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="AM or PM"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

            {/* Duration Presets (Chips) */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => { 
                      setDurationMinutes(preset.minutes); 
                      setShowCustomDuration(false);
                      setIsDirty(true); 
                    }}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-full border transition-all min-h-[44px]",
                      durationMinutes === preset.minutes && !showCustomDuration
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                    aria-pressed={durationMinutes === preset.minutes && !showCustomDuration}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomDuration(!showCustomDuration);
                    if (!showCustomDuration) {
                      setCustomDurationInput('');
                    }
                  }}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-full border transition-all min-h-[44px]",
                    showCustomDuration
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                  aria-pressed={showCustomDuration}
                >
                  Other...
                </button>
              </div>
              
              {showCustomDuration && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={customDurationInput}
                    onChange={(e) => setCustomDurationInput(e.target.value)}
                    onBlur={() => {
                      if (customDurationInput) {
                        const parsed = parseDurationInput(customDurationInput);
                        const validation = validateDurationInput(customDurationInput);
                        if (validation.valid && parsed > 0) {
                          setDurationMinutes(parsed);
                          setIsDirty(true);
                        } else if (!validation.valid) {
                          toast({
                            title: "Invalid duration",
                            description: validation.message,
                            variant: "destructive"
                          });
                          setCustomDurationInput('');
                        }
                      }
                    }}
                    placeholder="e.g., 45m, 1.5h"
                    className="flex-1 h-11 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Custom duration"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCustomDuration(false);
                      setCustomDurationInput('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              
              {/* Ends at - stacked below */}
              <div className="flex items-center gap-2 text-sm mt-2">
                <span className="text-muted-foreground">Ends at:</span>
              <span className="font-medium text-foreground">
                {endTime}
              </span>
                {outsideWorkingHours && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          type="button"
                          className="inline-flex items-center text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 ml-2"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span>Outside normal hours</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">This opening is outside your configured working hours</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

          {/* Appointment Details */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Appointment Type (Optional)</Label>
              <Combobox
                value={appointmentName}
                onValueChange={(value) => {
                  setAppointmentName(value);
                  setIsDirty(true);
                }}
                options={localSavedNames.map(name => ({
                  value: name,
                  label: name
                }))}
                placeholder="e.g., Haircut, Consultation"
                className="w-full"
                allowCustom={true}
                footerAction={{
                  label: "Add appointment type",
                  onClick: handleSaveAppointmentType
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
                placeholder="Add any notes or special instructions"
                rows={2}
                maxLength={120}
                className="text-base resize-none"
                aria-label="Notes"
              />
              {notes.length > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  {notes.length}/120 characters
                </p>
              )}
            </div>
          </div>

          {/* Publish Now Toggle */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <Label htmlFor="publish-now" className="text-sm font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Publish Now
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notifies subscribers immediately when saved
                </p>
              </div>
              <Switch
                id="publish-now"
                checked={publishNow}
                onCheckedChange={(checked) => { setPublishNow(checked); setIsDirty(true); }}
              />
            </div>
          </div>

          {/* Staff Info */}
          {primaryStaff && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Staff: <span className="font-medium text-foreground">{primaryStaff.name}</span>
              </p>
            </div>
          )}
        </div>
  );

  const footerContent = (
    <div className="sticky bottom-0 bg-background border-t border-border p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-safe z-20">
      <div className="flex flex-col sm:flex-row gap-2">
        {opening && onDelete && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeleteConfirm(true)}
            className="sm:mr-auto border-destructive/30 text-destructive hover:bg-destructive/10 min-h-[44px]"
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
        
        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 sm:flex-initial min-w-[80px] min-h-[44px]"
          >
            Cancel
          </Button>
          {!publishNow && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex-1 sm:flex-initial min-w-[100px] min-h-[44px]"
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </Button>
          )}
          <Button
            onClick={() => handleSave(publishNow)}
            disabled={loading}
            className="flex-1 sm:flex-initial min-w-[100px] min-h-[44px]"
          >
            {loading ? 'Saving...' : publishNow ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Publish
              </>
            ) : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={handleClose}>
          <SheetContent 
            side="bottom" 
            className="h-[88vh] p-0 flex flex-col rounded-t-2xl overflow-hidden"
          >
            <SheetHeader className="sticky top-0 z-20 px-4 pt-4 pb-3 border-b border-border bg-background">
              <SheetTitle className="text-left">
                {opening ? 'Edit Opening' : 'Add Opening'}
              </SheetTitle>
              <p className="text-xs text-muted-foreground text-left">
                {publishNow ? 'Notify subscribers instantly' : 'Save as draft'}
              </p>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
              {modalContent}
              {/* Bottom padding to ensure content isn't hidden by sticky footer */}
              <div className="h-20" aria-hidden="true" />
            </div>
            {footerContent}
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
        <DialogContent className="sm:max-w-[600px] max-w-[95vw] p-0 gap-0 flex flex-col max-h-[86vh] overflow-hidden">
          <DialogHeader className="sticky top-0 z-20 px-6 pt-6 pb-4 border-b border-border bg-background">
            <DialogTitle className="text-left">
              {opening ? 'Edit Opening' : 'Add Opening'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground text-left">
              {publishNow ? 'Notify subscribers instantly' : 'Save as draft'}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {modalContent}
            {/* Bottom padding to ensure content isn't hidden by sticky footer */}
            <div className="h-16" aria-hidden="true" />
          </div>
          {footerContent}
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
