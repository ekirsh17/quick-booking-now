import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppointmentPreset {
  id: string;
  label: string;
  color_token?: string | null;
  position: number;
  labelOverride?: string; // Optional: use this value instead of label for onChange
}

interface AppointmentTypePillsProps {
  value: string;
  onChange: (value: string) => void;
  presets: AppointmentPreset[];
  maxVisiblePills?: number;
}

export const AppointmentTypePills = ({
  value,
  onChange,
  presets,
  maxVisiblePills = 4,
}: AppointmentTypePillsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Sort presets by position
  const sortedPresets = [...presets].sort((a, b) => a.position - b.position);
  
  // Split into visible and overflow
  const visiblePresets = sortedPresets.slice(0, maxVisiblePills);
  const overflowPresets = sortedPresets.slice(maxVisiblePills);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedIndex === -1) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, visiblePresets.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedIndex < visiblePresets.length) {
          onChange(visiblePresets[focusedIndex].label);
        }
      } else if (e.key === 'Escape') {
        setFocusedIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, visiblePresets, onChange]);

  if (presets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-3 px-4 border border-dashed rounded-md">
        No appointment types yet. Add types in Settings.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Appointment Type"
      className="flex flex-wrap gap-2"
    >
      {/* Visible pills */}
      {visiblePresets.map((preset, index) => {
        const presetValue = preset.labelOverride || preset.label;
        const isSelected = value === presetValue;
        
        return (
          <Button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onChange(presetValue);
              setFocusedIndex(-1);
            }}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => {
              // Only reset focus if not moving to another pill
              setTimeout(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setFocusedIndex(-1);
                }
              }, 0);
            }}
            className={cn(
              "h-9 px-3 text-sm transition-all",
              focusedIndex === index && "ring-2 ring-ring ring-offset-2"
            )}
          >
            {preset.label}
          </Button>
        );
      })}

      {/* Overflow dropdown */}
      {overflowPresets.length > 0 && (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-sm"
            >
              More
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-56 max-h-[300px] overflow-y-auto bg-popover border border-border shadow-md z-50"
          >
            {overflowPresets.map((preset) => {
              const presetValue = preset.labelOverride || preset.label;
              return (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => {
                    onChange(presetValue);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer",
                    value === presetValue && "bg-accent"
                  )}
                >
                  {preset.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Optional "None" button */}
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
};
