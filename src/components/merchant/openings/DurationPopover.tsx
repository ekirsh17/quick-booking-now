import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div>{trigger}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        className="w-56 max-h-[320px] overflow-y-auto"
        sideOffset={5}
      >
        {allDurations.map((duration) => (
          <DropdownMenuItem
            key={duration.minutes}
            onClick={() => handleDurationSelect(duration.minutes)}
            className={cn(
              "cursor-pointer hover:bg-accent/10 focus:bg-accent/10",
              value === duration.minutes && "bg-accent text-accent-foreground"
            )}
          >
            {duration.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
