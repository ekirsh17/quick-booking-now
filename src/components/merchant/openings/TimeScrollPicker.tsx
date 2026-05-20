import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TimeSlot {
  label: string;
  hour12: string;
  minute: string;
  isAM: boolean;
}

interface TimeScrollPickerProps {
  selectedHour: string;
  selectedMinute: string;
  isAM: boolean;
  onSelect: (hour: string, minute: string, isAM: boolean) => void;
  isOpen?: boolean;
}

const buildTimeSlots = (): TimeSlot[] => {
  return Array.from({ length: 96 }, (_, i) => {
    const totalMinutes = i * 15;
    const hour24 = Math.floor(totalMinutes / 60);
    const minuteNum = totalMinutes % 60;
    const isAM = hour24 < 12;
    const hour12Num = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const hour12 = hour12Num.toString();
    const minute = minuteNum.toString().padStart(2, '0');

    return {
      label: `${hour12}:${minute} ${isAM ? 'AM' : 'PM'}`,
      hour12,
      minute,
      isAM,
    };
  });
};

const TIME_SLOTS = buildTimeSlots();

const getClosestSlotIndex = (hour: string, minute: string, isAM: boolean): number => {
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);

  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
    return 0;
  }

  let hour24 = parsedHour;
  if (isAM && hour24 === 12) hour24 = 0;
  if (!isAM && hour24 !== 12) hour24 += 12;

  const totalMinutes = hour24 * 60 + parsedMinute;
  const nearestQuarter = Math.round(totalMinutes / 15);

  return Math.max(0, Math.min(TIME_SLOTS.length - 1, nearestQuarter));
};

export const TimeScrollPicker = ({
  selectedHour,
  selectedMinute,
  isAM,
  onSelect,
  isOpen = true,
}: TimeScrollPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = useMemo(
    () => getClosestSlotIndex(selectedHour, selectedMinute, isAM),
    [selectedHour, selectedMinute, isAM]
  );

  const [keyboardIndex, setKeyboardIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!isOpen) return;
    setKeyboardIndex(selectedIndex);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const target = rowRefs.current[keyboardIndex];
    if (!target) return;

    target.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [isOpen, keyboardIndex]);

  const moveKeyboardSelection = (nextIndex: number) => {
    const bounded = Math.max(0, Math.min(TIME_SLOTS.length - 1, nextIndex));
    setKeyboardIndex(bounded);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveKeyboardSelection(keyboardIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveKeyboardSelection(keyboardIndex - 1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const slot = TIME_SLOTS[keyboardIndex];
      onSelect(slot.hour12, slot.minute, slot.isAM);
    }
  };

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Select time"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      className={cn(
        'max-h-[220px] overflow-y-auto p-1 outline-none'
      )}
      style={{
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {TIME_SLOTS.map((slot, index) => {
        const isSelected = selectedIndex === index;
        const isKeyboardFocused = keyboardIndex === index;

        return (
          <button
            key={slot.label}
            ref={(element) => {
              rowRefs.current[index] = element;
            }}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(slot.hour12, slot.minute, slot.isAM)}
            className={cn(
              'w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors focus:outline-none',
              isSelected
                ? 'bg-warning text-warning-foreground hover:bg-warning active:bg-warning'
                : 'text-foreground hover:bg-accent/15 hover:text-foreground active:bg-accent/15',
              isKeyboardFocused && !isSelected && 'bg-accent/15 text-foreground'
            )}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
};

export type { TimeSlot, TimeScrollPickerProps };
