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
  highlightedOpeningId?: string | null;
}

export const DayView = ({
  currentDate,
  openings,
  workingHours,
  onTimeSlotClick,
  onOpeningClick,
  highlightedOpeningId,
}: DayViewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showOnlyWorkingHours, setShowOnlyWorkingHours] = useState(() => {
    const saved = localStorage.getItem('openings-show-working-hours');
    return saved !== null ? saved === 'true' : true;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ y: number; time: Date } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ y: number; time: Date } | null>(null);
  const [noticeHidden, setNoticeHidden] = useState(() => {
    const saved = localStorage.getItem('openings-outside-hours-notice-dismissed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('openings-show-working-hours', showOnlyWorkingHours.toString());
  }, [showOnlyWorkingHours]);

  useEffect(() => {
    localStorage.setItem('openings-outside-hours-notice-dismissed', noticeHidden.toString());
  }, [noticeHidden]);

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

  // Filter hours based on toggle (STRICT MODE)
  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const visibleHours = useMemo(() => {
    if (!showOnlyWorkingHours) {
      return allHours;
    }

    // STRICT MODE: Show ONLY configured working hours
    const minHour = workingStartHour;
    const maxHour = workingEndHour;

    return allHours.filter(h => h >= minHour && h < maxHour);
  }, [showOnlyWorkingHours, workingStartHour, workingEndHour]);

  // Detect openings outside working hours
  const outsideHoursOpenings = useMemo(() => {
    if (!showOnlyWorkingHours || !dayWorkingHours?.enabled) return [];
    
    return openings.filter(opening => {
      const startHour = new Date(opening.start_time).getHours();
      const endHour = new Date(opening.end_time).getHours();
      const endMinute = new Date(opening.end_time).getMinutes();
      
      return startHour < workingStartHour || 
             (endHour > workingEndHour || (endHour === workingEndHour && endMinute > 0));
    }).sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [openings, showOnlyWorkingHours, workingStartHour, workingEndHour, dayWorkingHours]);

  const hasOpeningsOutsideWorkingHours = outsideHoursOpenings.length > 0;

  // Current time indicator
  const now = new Date();
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const totalMinutes = visibleHours.length * 60;
  const currentTimePosition = showOnlyWorkingHours && visibleHours.length > 0
    ? ((currentMinutes - visibleHours[0] * 60) / totalMinutes) * 100
    : (currentMinutes / 1440) * 100;

  // Scroll to first outside-hours opening
  const scrollToFirstOutsideOpening = () => {
    if (!scrollContainerRef.current || outsideHoursOpenings.length === 0) return;
    
    const firstOpening = outsideHoursOpenings[0];
    const openingStartHour = new Date(firstOpening.start_time).getHours();
    const openingStartMinute = new Date(firstOpening.start_time).getMinutes();
    
    const targetMinutes = openingStartHour * 60 + openingStartMinute - 30;
    const scrollTarget = (targetMinutes / 1440) * scrollContainerRef.current.scrollHeight;
    
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth'
      });
    }, 100);
  };

  // Handle "Show all" button click
  const handleShowAll = () => {
    setShowOnlyWorkingHours(false);
    scrollToFirstOutsideOpening();
  };

  // Auto-scroll to working hours start on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      let targetMinutes: number;
      
      if (isToday) {
        const workingStartMinutes = workingStartHour * 60;
        targetMinutes = Math.max(workingStartMinutes, currentMinutes - 120);
      } else {
        targetMinutes = workingStartHour * 60;
      }
      
      const adjustedTargetMinutes = showOnlyWorkingHours && visibleHours.length > 0
        ? Math.max(0, targetMinutes - visibleHours[0] * 60)
        : targetMinutes;
      
      const scrollTarget = (adjustedTargetMinutes / totalMinutes) * scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = scrollTarget;
    }
  }, [currentDate, isToday, currentMinutes, showOnlyWorkingHours, visibleHours, totalMinutes, workingStartHour]);

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
  }, [openings, visibleHours, showOnlyWorkingHours, currentDate]);

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
    if (!isDragging || !dragStart) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    // Calculate duration - if dragCurrent exists, use it; otherwise use minimum 15 minutes
    let durationMinutes = 15;
    
    if (dragCurrent && dragCurrent.time.getTime() !== dragStart.time.getTime()) {
      const durationMs = Math.abs(dragCurrent.time.getTime() - dragStart.time.getTime());
      durationMinutes = Math.max(15, Math.round(durationMs / 60000 / 15) * 15);
    }
    
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
    
    // Calculate snapped positions for visual preview
    const durationMs = Math.abs(dragCurrent.time.getTime() - dragStart.time.getTime());
    const durationMinutes = Math.max(15, Math.round(durationMs / 60000 / 15) * 15);
    
    // Calculate pixel positions based on snapped duration
    const startMinutes = dragStart.time.getHours() * 60 + dragStart.time.getMinutes() - minHour * 60;
    const startY = (startMinutes / 60) * hourHeight;
    const height = (durationMinutes / 60) * hourHeight;
    
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    return (
      <div
        className="absolute left-16 right-0 bg-primary/20 border-2 border-primary rounded pointer-events-none z-30 flex items-center justify-center"
        style={{ top: `${startY}px`, height: `${height}px` }}
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

  const scrollContainerHeight = useMemo(() => {
    const hoursShown = visibleHours.length;
    const pixelsPerHour = 60;
    const contentHeight = hoursShown * pixelsPerHour;
    
    if (showOnlyWorkingHours) {
      const minHeight = 400;
      const maxHeight = Math.min(contentHeight + 80, window.innerHeight - 280);
      return `${Math.max(minHeight, contentHeight)}px`;
    }
    
    return 'calc(100vh - 280px)';
  }, [visibleHours.length, showOnlyWorkingHours]);

  return (
    <div 
      key={currentDate.toISOString().split('T')[0]}
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-opacity duration-150 ease-in-out"
    >
      <div
        ref={scrollContainerRef}
        className="relative overflow-y-auto overflow-x-hidden"
        style={{ height: scrollContainerHeight }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Outside working hours notice - dismissible */}
        {hasOpeningsOutsideWorkingHours && !noticeHidden && (
          <div className="sticky top-0 z-40 bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-sm border-b border-amber-200/50 dark:border-amber-800/50">
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
              <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              
              <span className="text-amber-700 dark:text-amber-300 flex-1">
                You have {outsideHoursOpenings.length} appointment{outsideHoursOpenings.length !== 1 ? 's' : ''} outside of working hours today
              </span>
              
              <button
                onClick={handleShowAll}
                className="text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 font-medium underline underline-offset-2 flex-shrink-0"
              >
                Show all
              </button>
              
              <button
                onClick={() => setNoticeHidden(true)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex-shrink-0 p-0.5"
                aria-label="Dismiss notice"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
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
                className="absolute left-16 right-0 top-0 bottom-0 cursor-pointer transition-colors"
              >
                {/* Empty slot hint on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {!isDragging && (
                    <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      Click or drag to add opening
                    </span>
                  )}
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
                className="absolute left-0 right-0 border-t-2 border-accent z-20 pointer-events-none"
                style={{ top: `${currentTimePosition}%` }}
              >
                <div className="absolute left-0 w-3 h-3 bg-accent rounded-full -translate-x-1/2 -translate-y-1/2" />
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
              isHighlighted={opening.id === highlightedOpeningId}
            />
          ))}
        </div>
      </div>

      {/* Legend with toggle */}
      <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center justify-between gap-4 text-xs">
        {dayWorkingHours?.enabled && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,hsl(var(--muted))_2px,hsl(var(--muted))_4px)] border border-border rounded" />
            <span>Outside working hours ({dayWorkingHours.start} - {dayWorkingHours.end})</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Label 
            htmlFor="working-hours-toggle" 
            className="text-muted-foreground cursor-pointer text-xs"
          >
            Only show working hours
          </Label>
          <Switch
            id="working-hours-toggle"
            checked={showOnlyWorkingHours}
            onCheckedChange={setShowOnlyWorkingHours}
          />
        </div>
      </div>
    </div>
  );
};
