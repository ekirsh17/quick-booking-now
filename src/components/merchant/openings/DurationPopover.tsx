import { useState, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DurationPreset } from '@/hooks/useDurationPresets';
import { useMediaQuery } from '@/hooks/use-mobile';

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
  const [showCustom, setShowCustom] = useState(false);
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
      setShowCustom(false);
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
        <div className="space-y-3">
          {/* Chip grid - 2 columns with taller buttons */}
          <div className="grid grid-cols-2 gap-2">
            {displayDurations.map((duration) => (
              <Button
                key={duration.minutes}
                type="button"
                variant={value === duration.minutes ? 'default' : 'secondary'}
                size="sm"
                onClick={() => onChange(duration.minutes)}
                className="h-12 text-sm font-medium"
              >
                {duration.label}
              </Button>
            ))}
          </div>

          {/* Custom button/input in bottom right */}
          <div className="flex justify-end">
            {!showCustom ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustom(true)}
                className="h-12 text-sm text-muted-foreground hover:text-foreground"
              >
                Custom
              </Button>
            ) : (
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="5"
                  max="180"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Minutes"
                  className="h-12 w-24 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomSubmit();
                    } else if (e.key === 'Escape') {
                      setShowCustom(false);
                      setCustomInput('');
                    }
                  }}
                  onBlur={() => {
                    if (!customInput) {
                      setShowCustom(false);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCustomSubmit}
                  disabled={!customInput}
                  className="h-12 text-sm px-4"
                >
                  Set
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCustom(false);
                    setCustomInput('');
                  }}
                  className="h-12 w-12 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
