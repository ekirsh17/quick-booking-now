import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OpeningChipProps {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  position: { top: number; left: number };
  onEdit: () => void;
  onDelete: () => void;
  onTimeChange: (start: { hour: number; minute: number }, end: { hour: number; minute: number }) => void;
  onClose: () => void;
  isNewSelection?: boolean;
}

export const OpeningChip = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  position,
  onEdit,
  onDelete,
  onTimeChange,
  onClose,
  isNewSelection = false,
}: OpeningChipProps) => {
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [startValue, setStartValue] = useState(`${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`);
  const [endValue, setEndValue] = useState(`${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`);

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const handleStartBlur = () => {
    const [hour, minute] = startValue.split(':').map(Number);
    if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      onTimeChange({ hour, minute }, { hour: endHour, minute: endMinute });
    } else {
      setStartValue(`${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`);
    }
    setEditingStart(false);
  };

  const handleEndBlur = () => {
    const [hour, minute] = endValue.split(':').map(Number);
    if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      onTimeChange({ hour: startHour, minute: startMinute }, { hour, minute });
    } else {
      setEndValue(`${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`);
    }
    setEditingEnd(false);
  };

  return (
    <div
      className="absolute z-50 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]"
      style={{
        top: Math.max(8, position.top - 60),
        left: Math.max(8, Math.min(position.left, window.innerWidth - 296)),
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 shadow-md hover:bg-accent"
        aria-label="Close"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Time inputs */}
      <div className="flex items-center gap-2 mb-3">
        {editingStart ? (
          <Input
            type="time"
            value={startValue}
            onChange={(e) => setStartValue(e.target.value)}
            onBlur={handleStartBlur}
            autoFocus
            className="h-8 text-xs w-24"
          />
        ) : (
          <button
            onClick={() => setEditingStart(true)}
            className={cn(
              "text-sm font-medium hover:bg-accent px-2 py-1 rounded transition-colors",
              "min-w-[80px] text-left"
            )}
          >
            {formatTime(startHour, startMinute)}
          </button>
        )}
        
        <span className="text-muted-foreground text-xs">to</span>
        
        {editingEnd ? (
          <Input
            type="time"
            value={endValue}
            onChange={(e) => setEndValue(e.target.value)}
            onBlur={handleEndBlur}
            autoFocus
            className="h-8 text-xs w-24"
          />
        ) : (
          <button
            onClick={() => setEditingEnd(true)}
            className={cn(
              "text-sm font-medium hover:bg-accent px-2 py-1 rounded transition-colors",
              "min-w-[80px] text-left"
            )}
          >
            {formatTime(endHour, endMinute)}
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="flex-1 h-8 text-xs"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit details
        </Button>
        
        {isNewSelection && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            className="h-8 px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
