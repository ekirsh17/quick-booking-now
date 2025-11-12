import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Ellipsis, X } from 'lucide-react';
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
  label?: React.ReactNode; // Optional label for integrated header
  showLabel?: boolean; // Whether to show the integrated header
  labelSuffix?: React.ReactNode; // Optional suffix like "(optional)"
  inlineActions?: boolean; // Whether to show More/Clear inline with pills (modern layout)
}

export const AppointmentTypePills = ({
  value,
  onChange,
  presets,
  maxVisiblePills = 4,
  label,
  showLabel = false,
  labelSuffix,
  inlineActions = false,
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
      <div className="space-y-2">
        {showLabel && label && (
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {label}
              {labelSuffix && <span className="ml-1">{labelSuffix}</span>}
            </div>
          </div>
        )}
        <div className="text-sm text-muted-foreground py-3 px-4 border border-dashed rounded-md">
          No presets yet. Add in Settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Integrated header with label */}
      {showLabel && label && (
        <div className="text-sm font-medium">
          {label}
          {labelSuffix && <span className="ml-1">{labelSuffix}</span>}
        </div>
      )}
      
      {/* Preset pills and controls */}
      <div className={cn(
        "flex items-start gap-3",
        inlineActions ? "flex-wrap lg:flex-nowrap lg:justify-between" : "flex-col space-y-2"
      )}>
        {/* Pills container */}
        <div
          ref={containerRef}
          role="radiogroup"
          aria-label="Appointment Type"
          className={cn(
            "flex flex-wrap gap-2",
            inlineActions && "flex-1"
          )}
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

      {/* Standalone More/Clear for non-header mode (backward compat) */}
      {!showLabel && overflowPresets.length > 0 && (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "h-9 px-3 text-sm font-medium rounded-2xl transition-all",
                "bg-muted text-foreground/80",
                "hover:bg-muted/70 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "inline-flex items-center gap-1",
                isOpen && "bg-muted/50"
              )}
            >
              More
              <ChevronDown 
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  isOpen && "rotate-180"
                )} 
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-56 max-h-[300px] overflow-y-auto bg-popover shadow-md shadow-muted/40 border-0 z-50"
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
                    "cursor-pointer rounded-lg mx-1 my-0.5",
                    "hover:bg-muted/70 focus:bg-muted/70",
                    "transition-colors",
                    value === presetValue && "bg-accent text-accent-foreground"
                  )}
                >
                  {preset.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {!showLabel && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn(
            "text-sm text-foreground/50 hover:text-foreground/80",
            "underline underline-offset-4 decoration-foreground/30",
            "hover:decoration-foreground/60",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm",
            "px-2 py-1"
          )}
        >
          Clear
        </button>
      )}
        </div>
        
        {/* Inline actions (modern layout) - right-aligned with pills */}
        {inlineActions && showLabel && (overflowPresets.length > 0 || value) && (
          <div className={cn(
            "flex items-center gap-2 flex-shrink-0",
            "w-full lg:w-auto justify-center lg:justify-end mt-2 lg:mt-0"
          )}>
            {/* More button */}
            {overflowPresets.length > 0 && (
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={overflowPresets.length === 0}
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      "text-sm font-medium text-muted-foreground hover:text-foreground",
                      "transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                    aria-label="Show more options"
                  >
                    <Ellipsis className="h-4 w-4" />
                    <span>More</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 max-h-[300px] overflow-y-auto bg-popover shadow-md shadow-muted/40 border-0 z-50"
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
                          "cursor-pointer rounded-lg mx-1 my-0.5",
                          "hover:bg-muted/70 focus:bg-muted/70",
                          "transition-colors",
                          value === presetValue && "bg-accent text-accent-foreground"
                        )}
                      >
                        {preset.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Clear button */}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                disabled={!value}
                className={cn(
                  "inline-flex items-center gap-1.5",
                  "text-sm font-medium text-muted-foreground hover:text-foreground",
                  "transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}
        
        {/* Below actions (legacy layout) - below pills when not inline */}
        {!inlineActions && showLabel && (overflowPresets.length > 0 || value) && (
          <div className="flex items-center gap-3">
            {/* More button */}
            {overflowPresets.length > 0 && (
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "text-xs text-foreground/60 hover:text-foreground/90",
                      "transition-colors inline-flex items-center gap-0.5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm px-1.5 py-0.5"
                    )}
                  >
                    More
                    <ChevronDown 
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} 
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-56 max-h-[300px] overflow-y-auto bg-popover shadow-md shadow-muted/40 border-0 z-50"
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
                          "cursor-pointer rounded-lg mx-1 my-0.5",
                          "hover:bg-muted/70 focus:bg-muted/70",
                          "transition-colors",
                          value === presetValue && "bg-accent text-accent-foreground"
                        )}
                      >
                        {preset.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Clear button */}
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className={cn(
                  "text-xs text-foreground/50 hover:text-foreground/80",
                  "transition-colors inline-flex items-center gap-0.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm px-1.5 py-0.5"
                )}
                title="Clear selection"
              >
                Clear ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
