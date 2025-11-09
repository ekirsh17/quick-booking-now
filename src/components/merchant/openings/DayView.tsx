import { useEffect, useRef, useMemo } from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { Opening, WorkingHours } from '@/types/openings';
import { OpeningCard } from './OpeningCard';
import { cn } from '@/lib/utils';

interface DayViewProps {
  currentDate: Date;
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date) => void;
  onOpeningClick: (opening: Opening) => void;
}

export const DayView = ({
  currentDate,
  openings,
  workingHours,
  onTimeSlotClick,
  onOpeningClick,
}: DayViewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get working hours for current day
  const dayName = format(currentDate, 'EEEE').toLowerCase();
  const dayWorkingHours = workingHours[dayName];

  // Parse working hours
  const workingStartHour = dayWorkingHours?.enabled
    ? parseInt(dayWorkingHours.start.split(':')[0])
    : null;
  const workingEndHour = dayWorkingHours?.enabled
    ? parseInt(dayWorkingHours.end.split(':')[0])
    : null;

  // Current time indicator
  const now = new Date();
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePosition = (currentMinutes / 1440) * 100; // 1440 = 24 hours * 60 minutes

  // Auto-scroll to current time on mount (2 hours before)
  useEffect(() => {
    if (scrollContainerRef.current && isToday) {
      const scrollTarget = Math.max(0, (currentMinutes - 120) / 1440) * scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = scrollTarget;
    }
  }, [currentDate, isToday, currentMinutes]);

  // Calculate opening card positions
  const openingPositions = useMemo(() => {
    return openings.map(opening => {
      const start = new Date(opening.start_time);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const top = (startMinutes / 1440) * 100;
      const height = (opening.duration_minutes / 1440) * 100;
      
      return {
        opening,
        style: {
          top: `${top}%`,
          height: `${height}%`,
        },
      };
    });
  }, [openings]);

  const handleHourClick = (hour: number) => {
    const clickedTime = setMinutes(setHours(currentDate, hour), 0);
    onTimeSlotClick(clickedTime);
  };

  const isNonWorkingHour = (hour: number) => {
    if (!workingStartHour || !workingEndHour) return false;
    return hour < workingStartHour || hour >= workingEndHour;
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="relative overflow-y-auto overflow-x-hidden"
        style={{ height: 'calc(100vh - 280px)' }}
      >
        {/* Time grid */}
        <div className="relative min-h-[1440px]">
          {/* Hour rows */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="relative h-[60px] border-b border-border group"
            >
              {/* Time label - sticky */}
              <div className="absolute left-0 top-0 w-16 h-full bg-muted/50 border-r border-border z-10 flex flex-col items-center justify-start pt-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {format(setHours(currentDate, hour), 'h a')}
                </span>
              </div>

              {/* Non-working hours shading */}
              {isNonWorkingHour(hour) && (
                <div className="absolute left-16 right-0 top-0 bottom-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,hsl(var(--muted)/0.3)_10px,hsl(var(--muted)/0.3)_20px)]" />
              )}

              {/* Clickable area */}
              <div
                onClick={() => handleHourClick(hour)}
                className="absolute left-16 right-0 top-0 bottom-0 cursor-pointer hover:bg-accent/20 transition-colors"
              >
                {/* Empty slot hint on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    Click to add opening
                  </span>
                </div>
              </div>

              {/* 30-minute line */}
              <div className="absolute left-16 right-0 top-1/2 border-t border-dashed border-border/50" />
            </div>
          ))}

          {/* Current time indicator */}
          {isToday && (
            <>
              <div
                className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                style={{ top: `${currentTimePosition}%` }}
              >
                <div className="absolute left-0 w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
              </div>
            </>
          )}

          {/* Opening cards */}
          {openingPositions.map(({ opening, style }) => (
            <OpeningCard
              key={opening.id}
              opening={opening}
              onClick={() => onOpeningClick(opening)}
              style={style}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      {dayWorkingHours?.enabled && (
        <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,hsl(var(--muted))_2px,hsl(var(--muted))_4px)] border border-border rounded" />
            <span>Outside working hours ({dayWorkingHours.start} - {dayWorkingHours.end})</span>
          </div>
        </div>
      )}
    </div>
  );
};
