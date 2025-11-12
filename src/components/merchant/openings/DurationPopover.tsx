import { useState, ReactNode } from 'react';
import { Ellipsis, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DurationPreset } from '@/hooks/useDurationPresets';

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
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handleClear = () => {
    onChange(30); // Reset to default 30 minutes
  };

  const handleCustomSubmit = () => {
    const parsed = parseInt(customInput);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 480) {
      onChange(parsed);
      setShowCustom(false);
      setCustomInput('');
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
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          {/* Chips + Actions Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap gap-2 flex-1">
              {displayDurations.slice(0, 6).map((duration) => (
                <Button
                  key={duration.minutes}
                  type="button"
                  variant={value === duration.minutes ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => onChange(duration.minutes)}
                  className="h-8 px-3 text-xs"
                >
                  {duration.label}
                </Button>
              ))}
            </div>

            {/* Right-aligned actions */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <Ellipsis className="h-4 w-4" />
                More
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={value === 30}
                className={cn(
                  "text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors ml-3",
                  value === 30 && "opacity-50 cursor-not-allowed"
                )}
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>

          {/* More Options - Extended List */}
          {showMore && (
            <div className="space-y-2 pt-2 border-t">
              <div className="text-sm font-medium">All Durations</div>
              <Command className="rounded-lg border">
                <CommandInput placeholder="Search duration..." />
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>No duration found.</CommandEmpty>
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
                          "cursor-pointer",
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
              <div className="pt-2 border-t space-y-2">
                <Label className="text-xs">Custom Duration (minutes)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="480"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="e.g., 90"
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCustomSubmit}
                    disabled={!customInput}
                  >
                    Set
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter 5-480 minutes
                </p>
              </div>
            </div>
          )}

          {/* Inline helper - Ends time and warning */}
          {endTime && (
            <div className="pt-2 border-t space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ends</span>
                <span className="text-sm font-medium">{endTime}</span>
              </div>
              {outsideWorkingHours && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs">Outside hours</span>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
