import { useEffect, useRef, useMemo, useState } from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { Opening, WorkingHours } from '@/types/openings';
import { OpeningCard } from './OpeningCard';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface DayViewProps {
  currentDate: Date;
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date, duration?: number) => void;
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
  const [showOnlyWorkingHours, setShowOnlyWorkingHours] = useState(() => {
    const saved = localStorage.getItem('openings-show-working-hours');
    return saved !== null ? saved === 'true' : true;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ y: number; time: Date } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ y: number; time: Date } | null>(null);

  useEffect(() => {
    localStorage.setItem('openings-show-working-hours', showOnlyWorkingHours.toString());
  }, [showOnlyWorkingHours]);

  // Get working hours for current day
  const dayName = format(currentDate, 'EEEE').toLowerCase();
  const dayWorkingHours = workingHours[dayName];

  // Parse working hours
  const workingStartHour = dayWorkingHours?.enabled
    ? parseInt(dayWorkingHours.start.split(':')[0])
    : 0;
  const workingEndHour = dayWorkingHours?.enabled
    ? parseInt(dayWorkingHours.end.split(':')[0])
    : 24;

  // Filter hours based on toggle and openings
  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const visibleHours = useMemo(() => {
    if (!showOnlyWorkingHours) {
      return allHours;
    }

    // Start with working hours range
    let minHour = workingStartHour;
    let maxHour = workingEndHour;

    // Extend range to include all openings
    openings.forEach(opening => {
      const start = new Date(opening.start_time);
      const end = new Date(opening.end_time);
      const startHour = start.getHours();
      const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
      
      minHour = Math.min(minHour, startHour);
      maxHour = Math.max(maxHour, endHour);
    });

    return allHours.filter(h => h >= minHour && h < maxHour);
  }, [showOnlyWorkingHours, workingStartHour, workingEndHour, openings]);

  // Current time indicator
  const now = new Date();
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const totalMinutes = visibleHours.length * 60;
  const currentTimePosition = showOnlyWorkingHours && visibleHours.length > 0
    ? ((currentMinutes - visibleHours[0] * 60) / totalMinutes) * 100
    : (currentMinutes / 1440) * 100;

  // Auto-scroll to current time on mount (2 hours before)
  useEffect(() => {
    if (scrollContainerRef.current && isToday) {
      const targetMinutes = showOnlyWorkingHours && visibleHours.length > 0
        ? Math.max(0, currentMinutes - visibleHours[0] * 60 - 120)
        : Math.max(0, currentMinutes - 120);
      const scrollTarget = (targetMinutes / totalMinutes) * scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = scrollTarget;
    }
  }, [currentDate, isToday, currentMinutes, showOnlyWorkingHours, visibleHours, totalMinutes]);

  // Calculate opening card positions
  const openingPositions = useMemo(() => {
    const minHour = visibleHours[0] || 0;
    const hourRange = visibleHours.length || 24;
    
    return openings.map(opening => {
      const start = new Date(opening.start_time);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const adjustedStartMinutes = showOnlyWorkingHours 
        ? startMinutes - minHour * 60
        : startMinutes;
      const top = (adjustedStartMinutes / (hourRange * 60)) * 100;
      const height = (opening.duration_minutes / (hourRange * 60)) * 100;
      
      return {
        opening,
        style: {
          top: `${top}%`,
          height: `${height}%`,
        },
      };
    });
  }, [openings, visibleHours, showOnlyWorkingHours]);

  const handleMouseDown = (e: React.MouseEvent, hour: number) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;
    
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;
    const clickedTime = setMinutes(setHours(currentDate, hour), 0);
    
    setIsDragging(true);
    setDragStart({ y: relativeY, time: clickedTime });
    setDragCurrent({ y: relativeY, time: clickedTime });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !scrollContainerRef.current) return;
    
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;
    
    const hourHeight = 60;
    const totalMinutes = Math.floor((relativeY - dragStart.y) / hourHeight * 60);
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    
    const endTime = new Date(dragStart.time);
    endTime.setMinutes(endTime.getMinutes() + Math.max(15, snappedMinutes));
    
    setDragCurrent({ y: relativeY, time: endTime });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const durationMs = dragCurrent.time.getTime() - dragStart.time.getTime();
    const durationMinutes = Math.max(15, Math.round(durationMs / 60000 / 15) * 15);
    
    onTimeSlotClick(dragStart.time, durationMinutes);
    
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStart, dragCurrent]);

  const getDragPreview = () => {
    if (!isDragging || !dragStart || !dragCurrent) return null;
    
    const minHour = visibleHours[0] || 0;
    const hourHeight = 60;
    const startY = dragStart.y - minHour * hourHeight;
    const currentY = dragCurrent.y - minHour * hourHeight;
    const height = Math.abs(currentY - startY);
    const top = Math.min(startY, currentY);
    
    const durationMs = Math.abs(dragCurrent.time.getTime() - dragStart.time.getTime());
    const durationMinutes = Math.max(15, Math.round(durationMs / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    return (
      <div
        className="absolute left-16 right-0 bg-primary/20 border-2 border-primary rounded pointer-events-none z-30 flex items-center justify-center"
        style={{ top: `${top}px`, height: `${Math.max(15, height)}px` }}
      >
        <span className="text-sm font-medium text-primary">{durationText}</span>
      </div>
    );
  };

  const handleHourClick = (hour: number, e: React.MouseEvent) => {
    if (isDragging) return;
    const clickedTime = setMinutes(setHours(currentDate, hour), 0);
    onTimeSlotClick(clickedTime, 30);
  };

  const isNonWorkingHour = (hour: number) => {
    if (!dayWorkingHours?.enabled) return false;
    return hour < workingStartHour || hour >= workingEndHour;
  };

  const containerHeight = visibleHours.length * 60;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="relative overflow-y-auto overflow-x-hidden"
        style={{ height: 'calc(100vh - 280px)' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Time grid */}
        <div className="relative" style={{ minHeight: `${containerHeight}px` }}>
          {getDragPreview()}
          
          {/* Hour rows */}
          {visibleHours.map((hour) => (
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
                onMouseDown={(e) => handleMouseDown(e, hour)}
                onClick={(e) => handleHourClick(hour, e)}
                className="absolute left-16 right-0 top-0 bottom-0 cursor-pointer hover:bg-accent/20 transition-colors"
              >
                {/* Empty slot hint on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    {isDragging ? 'Release to create' : 'Click or drag to add opening'}
                  </span>
                </div>
              </div>

              {/* 30-minute line */}
              <div className="absolute left-16 right-0 top-1/2 border-t border-dashed border-border/50" />
            </div>
          ))}

          {/* Current time indicator */}
          {isToday && currentTimePosition >= 0 && currentTimePosition <= 100 && (
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

      {/* Legend with toggle */}
      <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Switch
            id="working-hours-toggle"
            checked={showOnlyWorkingHours}
            onCheckedChange={setShowOnlyWorkingHours}
          />
          <Label 
            htmlFor="working-hours-toggle" 
            className="text-muted-foreground cursor-pointer"
          >
            Show only working hours
          </Label>
        </div>
        {dayWorkingHours?.enabled && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,hsl(var(--muted))_2px,hsl(var(--muted))_4px)] border border-border rounded" />
            <span>Outside working hours ({dayWorkingHours.start} - {dayWorkingHours.end})</span>
          </div>
        )}
      </div>
    </div>
  );
};
