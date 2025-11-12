import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as PopoverPrimitive from '@radix-ui/react-popover';
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
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <div>{trigger}</div>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="w-44 max-h-[220px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[90] p-1"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            pointerEvents: 'auto',
          }}
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="space-y-0.5">
            {allDurations.map((duration) => (
              <button
                key={duration.minutes}
                onClick={() => handleDurationSelect(duration.minutes)}
                className={cn(
                  "w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors focus:outline-none",
                  value === duration.minutes 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-primary/10 active:bg-primary/10"
                )}
              >
                {duration.label}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
