import { useState, useEffect } from 'react';
import { format, setHours, setMinutes, addMinutes, differenceInMinutes } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Combobox } from '@/components/ui/combobox';
import { AlertCircle, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Opening, WorkingHours, Staff } from '@/types/openings';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [appointmentName, setAppointmentName] = useState('');
  const [notes, setNotes] = useState('');
  const [outsideWorkingHours, setOutsideWorkingHours] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localSavedNames, setLocalSavedNames] = useState<string[]>(savedAppointmentNames);
  
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

  const handleSave = async () => {
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
      });

      onClose();
    } catch (error) {
      console.error('Error saving opening:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSaveAppointmentType = async () => {
    if (!appointmentName.trim() || !user) return;
    
    // Check if already saved
    if (localSavedNames.includes(appointmentName.trim())) {
      return;
    }
    
    const updatedNames = [...localSavedNames, appointmentName.trim()];
    
    const { error } = await supabase
      .from('profiles')
      .update({ saved_appointment_names: updatedNames })
      .eq('id', user.id);
    
    if (!error) {
      setLocalSavedNames(updatedNames);
      toast({
        title: "Appointment type saved",
        description: `"${appointmentName}" has been added to your presets.`,
      });
      // Keep the appointment name as is (it's already set)
    }
  };

  const handleSaveDuration = async () => {
    if (!user || durationMinutes === 0) return;
    
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
    
    if (!currentDurations.includes(durationMinutes)) {
      const updatedDurations = [...currentDurations, durationMinutes].sort((a, b) => a - b);
      
      await supabase
        .from('profiles')
        .update({ saved_durations: updatedDurations })
        .eq('id', user.id);
      
      toast({
        title: "Duration saved",
        description: `${formatDuration(durationMinutes)} added to your presets.`,
      });
      // Keep the duration as is (it's already set)
    }
  };

  const modalContent = (
    <div className="space-y-4 py-4">
          {/* Date & Time Section */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Start Time */}
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <div className="flex gap-2">
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="min-w-0 w-20 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {HOURS.map((hour) => (
                      <option key={hour.value} value={hour.value}>
                        {hour.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="min-w-0 w-20 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {MINUTES.map((minute) => (
                      <option key={minute.value} value={minute.value}>
                        {minute.label}
                      </option>
                    ))}
                  </select>
                  <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                    <button
                      type="button"
                      onClick={() => setIsAM(true)}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-medium rounded transition-all",
                        isAM ? "bg-background shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAM(false)}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-medium rounded transition-all",
                        !isAM ? "bg-background shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Combobox
                value={formatDuration(durationMinutes)}
                onValueChange={(value) => {
                  const parsed = parseDurationInput(value);
                  const validation = validateDurationInput(value);
                  if (validation.valid && parsed > 0) {
                    setDurationMinutes(parsed);
                  } else if (!validation.valid) {
                    toast({
                      title: "Invalid duration",
                      description: validation.message,
                      variant: "destructive"
                    });
                  }
                }}
                options={[
                  ...DURATION_PRESETS.map(preset => ({
                    value: preset.minutes.toString(),
                    label: preset.label,
                  })),
                  ...(savedDurations || [])
                    .filter(d => !DURATION_PRESETS.some(p => p.minutes === d))
                    .map(minutes => ({
                      value: minutes.toString(),
                      label: formatDuration(minutes),
                    }))
                ]}
                placeholder="e.g., 30m, 1.5h"
                className="w-full"
                allowCustom={true}
                footerAction={{
                  label: "Add duration",
                  onClick: handleSaveDuration
                }}
              />
              
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
          </div>

          {/* Appointment Details */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Appointment Type</Label>
              <Combobox
                value={appointmentName}
                onValueChange={setAppointmentName}
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
              <Label className="text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or special instructions"
                rows={3}
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
    <div className="flex-col sm:flex-row gap-2 flex">
      {opening && onDelete && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowDeleteConfirm(true)}
          className="sm:mr-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      )}
      
      <div className="flex gap-2 w-full sm:w-auto">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 sm:flex-initial"
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onClose}>
          <DrawerContent className="h-[90vh] max-h-[90vh] px-4">
            <div className="overflow-y-auto flex-1">
              <DrawerHeader className="px-0">
                <DrawerTitle>
                  {opening ? 'Edit Opening' : 'Add Opening'}
                </DrawerTitle>
              </DrawerHeader>
              {modalContent}
            </div>
            <DrawerFooter className="px-0">
              {footerContent}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Opening</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this opening? This action cannot be undone.
            </p>
            <DialogFooter>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {opening ? 'Edit Opening' : 'Add Opening'}
            </DialogTitle>
          </DialogHeader>
          {modalContent}
          <DialogFooter>
            {footerContent}
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
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
