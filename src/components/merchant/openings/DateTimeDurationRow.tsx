import { format } from 'date-fns';
import { Calendar, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DurationPopover } from './DurationPopover';
import { cn } from '@/lib/utils';
import { DurationPreset } from '@/hooks/useDurationPresets';
import { useMediaQuery } from '@/hooks/use-mobile';

interface DateTimeDurationRowProps {
  date: Date;
  onDateChange: (date: Date) => void;
  startHour: string;
  startMinute: string;
  isAM: boolean;
  onStartHourChange: (hour: string) => void;
  onStartMinuteChange: (minute: string) => void;
  onAMPMChange: (isAM: boolean) => void;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  durationPresets: DurationPreset[];
  endTime: string;
  outsideWorkingHours: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: (i + 1).toString(),
}));

const MINUTES = Array.from({ length: 12 }, (_, i) => ({
  value: (i * 5).toString().padStart(2, '0'),
  label: (i * 5).toString().padStart(2, '0'),
}));

export const DateTimeDurationRow = ({
  date,
  onDateChange,
  startHour,
  startMinute,
  isAM,
  onStartHourChange,
  onStartMinuteChange,
  onAMPMChange,
  durationMinutes,
  onDurationChange,
  durationPresets,
  endTime,
  outsideWorkingHours,
}: DateTimeDurationRowProps) => {
  const isMobile = useMediaQuery('(max-width: 640px)');
  
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatDateValue = (date: Date): string => {
    // Desktop: "Tue, Nov 11"
    // Mobile: "Tue, Nov 11" or fallback to "Nov 11" if too tight
    return isMobile 
      ? format(date, 'MMM d')
      : format(date, 'EEE, MMM d');
  };

  return (
    <div className="space-y-3">
      {/* Field cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Date Card */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Select date"
                className={cn(
                  "rounded-xl border border-border/60 bg-background",
                  "px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-3",
                  "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0 transition-all",
                  "text-left w-full"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {formatDateValue(date)}
                  </div>
                </div>
                <Calendar className="size-[18px] text-muted-foreground flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    onDateChange(d);
                    setTimeout(() => {
                      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                      document.dispatchEvent(escapeEvent);
                    }, 0);
                  }
                }}
                initialFocus
                className="pointer-events-auto [&_.rdp-day_selected]:bg-primary/10 [&_.rdp-day_selected]:text-primary [&_.rdp-day_selected]:rounded-lg [&_.rdp-day_selected]:font-semibold"
                classNames={{
                  day: "hover:bg-primary/10 hover:rounded-full hover:scale-110 transition-all p-2",
                  day_selected: "!bg-primary/10 !text-primary !rounded-lg !font-semibold hover:!bg-primary/10",
                  day_today: "text-primary font-bold"
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Card */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Time</label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Select time"
                className={cn(
                  "rounded-xl border border-border/60 bg-background",
                  "px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-3",
                  "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0 transition-all",
                  "text-left w-full"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {startHour}:{startMinute} {isAM ? 'AM' : 'PM'}
                  </div>
                </div>
                <Clock className="size-[18px] text-muted-foreground flex-shrink-0" />
              </button>
            </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Select Time</div>
              <div className="flex gap-2 items-center">
                <select
                  value={startHour}
                  onChange={(e) => onStartHourChange(e.target.value)}
                  className="h-10 w-20 text-sm rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Hour"
                >
                  {HOURS.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">:</span>
                <select
                  value={startMinute}
                  onChange={(e) => onStartMinuteChange(e.target.value)}
                  className="h-10 w-20 text-sm rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Minute"
                >
                  {MINUTES.map((minute) => (
                    <option key={minute.value} value={minute.value}>
                      {minute.label}
                    </option>
                  ))}
                </select>
                <div className="inline-flex h-10 rounded-md border border-input bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => onAMPMChange(true)}
                    className={cn(
                      "px-3 py-1 text-sm rounded-sm transition-colors",
                      isAM
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/10 hover:text-foreground"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => onAMPMChange(false)}
                    className={cn(
                      "px-3 py-1 text-sm rounded-sm transition-colors",
                      !isAM
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/10 hover:text-foreground"
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Duration Card - uses DurationPopover */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Duration</label>
          <DurationPopover
            value={durationMinutes}
            onChange={onDurationChange}
            presets={durationPresets}
            trigger={
              <button
                type="button"
                aria-label="Select duration"
                className={cn(
                  "rounded-xl border border-border/60 bg-background",
                  "px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-3",
                  "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0 transition-all",
                  "text-left w-full"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {formatDuration(durationMinutes)}
                  </div>
                </div>
                <ChevronDown className="size-[18px] text-muted-foreground flex-shrink-0" />
              </button>
            }
          />
        </div>
      </div>

      {/* Event summary text */}
      <div className="space-y-1.5">
        <div className="text-sm text-muted-foreground">
          This event will take place on {format(date, 'MMMM d, yyyy')} from {startHour}:{startMinute} {isAM ? 'AM' : 'PM'} until {endTime}
        </div>
        {outsideWorkingHours && (
          <div className="flex items-center gap-1.5 text-accent">
            <AlertTriangle className="size-3.5 flex-shrink-0" />
            <span className="text-xs">Outside business hours</span>
          </div>
        )}
      </div>
    </div>
  );
};
