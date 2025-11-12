import { useState, ReactNode } from 'react';
import { Ellipsis, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DurationPreset } from '@/hooks/useDurationPresets';
import { useMediaQuery } from '@/hooks/use-mobile';

interface DurationPopoverProps {
  value: number;
  onChange: (minutes: number) => void;
  presets: DurationPreset[];
  trigger: ReactNode;
  endTime?: string;
  outsideWorkingHours?: boolean;
}

const COMMON_DURATIONS = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 75, label: '1h 15m' },
  { minutes: 90, label: '1h 30m' },
];

// Extended durations: every 15m up to 3h (180 minutes)
const EXTENDED_DURATIONS = Array.from({ length: 12 }, (_, i) => {
  const minutes = (i + 1) * 15;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return {
    minutes,
    label: mins === 0 ? `${hours}h` : `${hours}h ${mins}m`,
  };
});

export const DurationPopover = ({
  value,
  onChange,
  presets,
  trigger,
  endTime,
  outsideWorkingHours,
}: DurationPopoverProps) => {
  const [showMore, setShowMore] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const isMobile = useMediaQuery('(max-width: 640px)');

  const handleClear = () => {
    onChange(30); // Reset to default 30 minutes
  };

  const handleCustomSubmit = () => {
    const parsed = parseInt(customInput);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 180) {
      onChange(parsed);
      setCustomInput('');
      setShowMore(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Use presets if available, otherwise use common durations
  const displayDurations = presets.length > 0
    ? presets.map(p => ({ minutes: p.duration_minutes, label: p.label }))
    : COMMON_DURATIONS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div>{trigger}</div>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="end"
        className={cn(
          "rounded-2xl border border-border/70 bg-popover shadow-xl shadow-black/10",
          "p-3",
          isMobile ? "w-[96vw] max-w-none" : "w-80 min-w-[320px]"
        )}
      >
        <div className="space-y-0">
          {/* Header actions row (top-right) */}
          <div className="flex items-center justify-end gap-3 mb-2">
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              aria-label="Show more durations"
            >
              <Ellipsis className="h-3.5 w-3.5" />
              More
            </button>
            {value !== 30 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                aria-label="Clear duration"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-border/60" />

          {/* Chip grid - 2 columns */}
          <div className="grid grid-cols-2 gap-2">
            {displayDurations.map((duration) => (
              <Button
                key={duration.minutes}
                type="button"
                variant={value === duration.minutes ? 'default' : 'secondary'}
                size="sm"
                onClick={() => onChange(duration.minutes)}
                className="h-8 text-xs"
              >
                {duration.label}
              </Button>
            ))}
          </div>

          {/* More Options - Extended List */}
          {showMore && (
            <>
              <div className="my-2 border-t border-border/60" />
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">All Durations</div>
                <Command className="rounded-lg border">
                  <CommandInput placeholder="Search duration..." className="h-8 text-xs" />
                  <CommandList className="max-h-[160px]">
                    <CommandEmpty className="text-xs py-4">No duration found.</CommandEmpty>
                    <CommandGroup>
                      {EXTENDED_DURATIONS.map((duration) => (
                        <CommandItem
                          key={duration.minutes}
                          value={duration.label}
                          onSelect={() => {
                            onChange(duration.minutes);
                            setShowMore(false);
                          }}
                          className={cn(
                            "cursor-pointer text-xs",
                            value === duration.minutes && "bg-accent"
                          )}
                        >
                          {duration.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>

                {/* Custom Duration Input */}
                <div className="pt-2 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Custom</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="5"
                      max="180"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Minutes"
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCustomSubmit();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCustomSubmit}
                      disabled={!customInput}
                      className="h-8 text-xs"
                    >
                      Set
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    5-180 minutes
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Helper block (bottom) - Ends time and warning */}
          {endTime && (
            <>
              <div className="mt-2 pt-2 border-t border-border/60" />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Ends {endTime}
                </div>
                {outsideWorkingHours && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-destructive flex-shrink-0" />
                    <span className="text-xs text-destructive">Outside business hours</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
