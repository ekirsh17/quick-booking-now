import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, X } from 'lucide-react';
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
  label?: string; // Optional label for integrated header
  showLabel?: boolean; // Whether to show the integrated header
  labelSuffix?: React.ReactNode; // Optional suffix like "(optional)"
}

export const AppointmentTypePills = ({
  value,
  onChange,
  presets,
  maxVisiblePills = 4,
  label,
  showLabel = false,
  labelSuffix,
}: AppointmentTypePillsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      onChange(customInput.trim());
      setCustomInput('');
      setShowCustom(false);
    }
  };

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
      {/* Integrated header with label and actions */}
      {showLabel && label && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">
            {label}
            {labelSuffix && <span className="ml-1">{labelSuffix}</span>}
          </div>
          
          {/* Secondary actions - right aligned */}
          <div className="flex items-center gap-1.5">
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
        </div>
      )}
      
      {/* Preset pills */}
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
      
      {/* Custom button/input */}
      {!showCustom ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowCustom(true)}
          className="h-9 text-sm text-muted-foreground hover:text-foreground"
        >
          Custom
        </Button>
      ) : (
        <div className="flex gap-2 items-center">
          <Input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type name..."
            className="h-9 w-32 text-sm"
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
            disabled={!customInput.trim()}
            className="h-9 text-sm"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowCustom(false);
              setCustomInput('');
            }}
            className="h-9 w-9 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

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
    </div>
  );
};
