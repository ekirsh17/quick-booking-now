import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DurationPreset } from '@/hooks/useDurationPresets';

interface DurationPopoverProps {
  value: number;
  onChange: (minutes: number) => void;
  presets: DurationPreset[];
  trigger: ReactNode;
}

const COMMON_DURATIONS = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 75, label: '1h 15m' },
  { minutes: 90, label: '1h 30m' },
];


export const DurationPopover = ({
  value,
  onChange,
  presets,
  trigger,
}: DurationPopoverProps) => {
  const [open, setOpen] = useState(false);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const handleDurationSelect = (minutes: number) => {
    onChange(minutes);
    setOpen(false);
  };

  // Combine presets with common durations, sort by minutes, and remove duplicates
  const allDurations = [
    ...COMMON_DURATIONS,
    ...presets.map(p => ({ minutes: p.duration_minutes, label: p.label }))
  ]
    .sort((a, b) => a.minutes - b.minutes)
    .filter((duration, index, self) => 
      index === self.findIndex(d => d.minutes === duration.minutes)
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>{trigger}</div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-36 max-h-[220px] overflow-y-auto z-50 bg-popover pointer-events-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ touchAction: 'manipulation' }}
      >
        {allDurations.map((duration) => (
          <button
            key={duration.minutes}
            onClick={() => handleDurationSelect(duration.minutes)}
            className={cn(
              "w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors hover:bg-primary/10 focus:outline-none active:bg-primary/10",
              value === duration.minutes && "bg-primary text-primary-foreground"
            )}
          >
            {duration.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
