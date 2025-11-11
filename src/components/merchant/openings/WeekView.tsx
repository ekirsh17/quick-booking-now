import { useEffect, useRef, useMemo, useState } from 'react';
import { format, startOfWeek, addDays, setHours, setMinutes, parse } from 'date-fns';
import { Opening, WorkingHours } from '@/types/openings';
import { OpeningCard } from './OpeningCard';
import { CalendarLegend } from './CalendarLegend';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface WeekViewProps {
  currentDate: Date;
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date, duration?: number) => void;
  onOpeningClick: (opening: Opening) => void;
  highlightedOpeningId?: string | null;
  profileDefaultDuration?: number;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
}

export const WeekView = ({
  currentDate,
  openings,
  workingHours,
  onTimeSlotClick,
  onOpeningClick,
  highlightedOpeningId,
  profileDefaultDuration,
  onPreviousWeek,
  onNextWeek,
}: WeekViewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showOnlyWorkingHours, setShowOnlyWorkingHours] = useState(() => {
    const saved = localStorage.getItem('openings-show-working-hours');
    return saved !== null ? saved === 'true' : true;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ y: number; time: Date; dayIndex: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ y: number; time: Date } | null>(null);
  const [mobileOffset, setMobileOffset] = useState(0);
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

  // Calculate week start (Sunday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Determine visible days for mobile (2-3 days)
  const MOBILE_DAYS_VISIBLE = 3;
  const visibleDays = weekDays.slice(mobileOffset, mobileOffset + MOBILE_DAYS_VISIBLE);

  // Calculate working hours range across all days (extends to show appointments that partially overlap)
  const { minHour, maxHour } = useMemo(() => {
    if (!showOnlyWorkingHours) return { minHour: 0, maxHour: 24 };

    let min = 24;
    let max = 0;

    // Get base working hours range across all days
    weekDays.forEach(day => {
      const dayName = format(day, 'EEEE').toLowerCase();
      const dayHours = workingHours[dayName];
      if (dayHours?.enabled) {
        const [startHour, startMinute] = dayHours.start.split(':').map(Number);
        const [endHour, endMinute] = dayHours.end.split(':').map(Number);
        min = Math.min(min, startHour);
        max = Math.max(max, endHour);
      }
    });

    // Extend range only for appointments that partially overlap with working hours
    openings.forEach(opening => {
      const startTime = new Date(opening.start_time);
      const endTime = new Date(opening.end_time);
      const startHour = startTime.getHours();
      const startMinute = startTime.getMinutes();
      const endHour = endTime.getHours();
      const endMinute = endTime.getMinutes();

      // Check if opening overlaps with its day's working hours
      const dayName = format(startTime, 'EEEE').toLowerCase();
      const dayHours = workingHours[dayName];
      if (dayHours?.enabled) {
        const [workingStartHour, workingStartMinute] = dayHours.start.split(':').map(Number);
        const [workingEndHour, workingEndMinute] = dayHours.end.split(':').map(Number);
        
        // Convert to minutes for precise overlap checking
        const openingStartMinutes = startHour * 60 + startMinute;
        const openingEndMinutes = endHour * 60 + endMinute;
        const workingStartMinutes = workingStartHour * 60 + workingStartMinute;
        const workingEndMinutes = workingEndHour * 60 + workingEndMinute;
        
        // Check if appointment overlaps with working hours
        const hasOverlap = openingStartMinutes < workingEndMinutes && openingEndMinutes > workingStartMinutes;

        if (hasOverlap) {
          // Extend start if opening starts earlier than working hours (round DOWN to nearest 30-min)
          if (openingStartMinutes < workingStartMinutes) {
            // Round down to nearest 30-minute mark
            const roundedStartMinutes = Math.floor(openingStartMinutes / 30) * 30;
            const roundedStartHour = Math.floor(roundedStartMinutes / 60);
            min = Math.min(min, roundedStartHour);
          }
          
          // Extend end if opening ends later than working hours (round UP to nearest 30-min)
          if (openingEndMinutes > workingEndMinutes) {
            // Round up to nearest 30-minute mark
            const roundedEndMinutes = Math.ceil(openingEndMinutes / 30) * 30;
            const roundedEndHour = Math.floor(roundedEndMinutes / 60);
            max = Math.max(max, roundedEndHour);
          }
        }
      }
    });

    return { minHour: min === 24 ? 9 : min, maxHour: max === 0 ? 17 : max };
  }, [showOnlyWorkingHours, workingHours, openings, weekDays]);

  const visibleHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  // Detect openings outside working hours
  const outsideHoursOpenings = useMemo(() => {
    if (!showOnlyWorkingHours) return [];
    
    return openings.filter(opening => {
      const startTime = new Date(opening.start_time);
      const startHour = startTime.getHours();
      const endHour = new Date(opening.end_time).getHours();
      const endMinute = new Date(opening.end_time).getMinutes();
      
      const dayName = format(startTime, 'EEEE').toLowerCase();
      const dayHours = workingHours[dayName];
      
      if (!dayHours?.enabled) return false;
      
      const [workingStartHour, workingStartMinute] = dayHours.start.split(':').map(Number);
      const [workingEndHour, workingEndMinute] = dayHours.end.split(':').map(Number);
      const workingStartMinutes = workingStartHour * 60 + workingStartMinute;
      const workingEndMinutes = workingEndHour * 60 + workingEndMinute;
      
      const startMinutes = startHour * 60 + new Date(opening.start_time).getMinutes();
      const endMinutes = endHour * 60 + endMinute;
      
      return startMinutes < workingStartMinutes || endMinutes > workingEndMinutes;
    }).sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [openings, showOnlyWorkingHours, workingHours]);

  const hasOpeningsOutsideWorkingHours = outsideHoursOpenings.length > 0;

  // Current time indicator
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const totalMinutes = visibleHours.length * 60;
  const currentTimePosition = ((currentMinutes - minHour * 60) / totalMinutes) * 100;

  // Scroll to first outside-hours opening
  const scrollToFirstOutsideOpening = () => {
    if (!scrollContainerRef.current || outsideHoursOpenings.length === 0) return;
    
    const firstOpening = outsideHoursOpenings[0];
    const openingStartHour = new Date(firstOpening.start_time).getHours();
    const openingStartMinute = new Date(firstOpening.start_time).getMinutes();
    
    const targetMinutes = openingStartHour * 60 + openingStartMinute - 30;
    const scrollTarget = ((targetMinutes - minHour * 60) / totalMinutes) * scrollContainerRef.current.scrollHeight;
    
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

  // Auto-scroll to current time or working hours start
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetMinutes = Math.max(0, currentMinutes - minHour * 60 - 120);
      const scrollTarget = (targetMinutes / totalMinutes) * scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = scrollTarget;
    }
  }, [currentDate, minHour, totalMinutes]);

  // Helper: Check if two openings overlap
  const doOpeningsOverlap = (a: Opening, b: Opening): boolean => {
    const aStart = new Date(a.start_time).getTime();
    const aEnd = new Date(a.end_time).getTime();
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  };

  // Helper: Find overlapping group
  const findOverlappingGroup = (opening: Opening, allOpenings: Opening[]): Opening[] => {
    const group = new Set<Opening>([opening]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const candidate of allOpenings) {
        if (group.has(candidate)) continue;
        for (const member of Array.from(group)) {
          if (doOpeningsOverlap(candidate, member)) {
            group.add(candidate);
            changed = true;
            break;
          }
        }
      }
    }

    return Array.from(group).sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  };

  // Helper: Assign columns
  const assignColumns = (openings: Opening[]): Map<string, number> => {
    const columns = new Map<string, number>();
    const columnEndTimes: number[] = [];

    for (const opening of openings) {
      const startTime = new Date(opening.start_time).getTime();
      let columnIndex = 0;
      while (columnIndex < columnEndTimes.length && columnEndTimes[columnIndex] > startTime) {
        columnIndex++;
      }
      columns.set(opening.id, columnIndex);
      columnEndTimes[columnIndex] = new Date(opening.end_time).getTime();
    }

    return columns;
  };

  // Calculate opening positions per day
  const getOpeningPositionsForDay = (dayDate: Date, dayOpenings: Opening[]) => {
    const processed = new Set<string>();
    const columnAssignments = new Map<string, { column: number; totalColumns: number }>();

    for (const opening of dayOpenings) {
      if (processed.has(opening.id)) continue;

      const overlappingGroup = findOverlappingGroup(opening, dayOpenings);

      if (overlappingGroup.length === 1) {
        columnAssignments.set(opening.id, { column: 0, totalColumns: 1 });
        processed.add(opening.id);
      } else {
        const columns = assignColumns(overlappingGroup);
        const maxColumn = Math.max(...Array.from(columns.values()));
        const totalColumns = maxColumn + 1;

        overlappingGroup.forEach(o => {
          columnAssignments.set(o.id, { column: columns.get(o.id) || 0, totalColumns });
          processed.add(o.id);
        });
      }
    }

    return dayOpenings.map(opening => {
      const start = new Date(opening.start_time);
      const startMinutes = start.getHours() * 60 + start.getMinutes() - minHour * 60;
      const top = (startMinutes / totalMinutes) * 100;
      const height = (opening.duration_minutes / totalMinutes) * 100;

      const assignment = columnAssignments.get(opening.id) || { column: 0, totalColumns: 1 };
      const widthPercent = 100 / assignment.totalColumns;
      const leftPercent = assignment.column * widthPercent;

      return {
        opening,
        style: {
          top: `${top}%`,
          height: `${height}%`,
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
        },
      };
    });
  };

  // Mouse event handlers for drag-to-create
  const handleMouseDown = (e: React.MouseEvent, hour: number, dayIndex: number) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;

    const hourButton = e.currentTarget as HTMLElement;
    const hourRect = hourButton.getBoundingClientRect();
    const clickY = e.clientY - hourRect.top;
    const hourHeight = 60;
    const minutesFromClick = Math.floor((clickY / hourHeight) * 60);
    const snappedMinutes = Math.floor(minutesFromClick / 15) * 15;

    const clickedTime = new Date(weekDays[dayIndex]);
    clickedTime.setHours(hour, snappedMinutes, 0, 0);

    const defaultMinutes = profileDefaultDuration || 30;
    const initialEndTime = new Date(clickedTime);
    initialEndTime.setMinutes(initialEndTime.getMinutes() + defaultMinutes);

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;

    setIsDragging(true);
    setDragStart({ y: relativeY, time: clickedTime, dayIndex });
    setDragCurrent({ y: relativeY, time: initialEndTime });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !scrollContainerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;

    const hourHeight = 60;
    const totalMinutes = Math.floor((relativeY - dragStart.y) / hourHeight * 60);
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    const defaultMinutes = profileDefaultDuration || 30;
    const finalMinutes = snappedMinutes === 0 ? defaultMinutes : Math.max(15, defaultMinutes + snappedMinutes);

    const endTime = new Date(dragStart.time);
    endTime.setMinutes(endTime.getMinutes() + finalMinutes);

    setDragCurrent({ y: relativeY, time: endTime });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    let durationMinutes = profileDefaultDuration || 30;

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
      if (isDragging) handleMouseUp();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStart, dragCurrent]);

  const getDragPreview = (dayIndex: number) => {
    if (!isDragging || !dragStart || !dragCurrent || dragStart.dayIndex !== dayIndex) return null;

    const hourHeight = 60;
    const durationMs = Math.abs(dragCurrent.time.getTime() - dragStart.time.getTime());
    const durationMinutes = Math.max(15, Math.round(durationMs / 60000 / 15) * 15);

    const startMinutes = dragStart.time.getHours() * 60 + dragStart.time.getMinutes() - minHour * 60;
    const startY = (startMinutes / 60) * hourHeight;
    const height = (durationMinutes / 60) * hourHeight;

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return (
      <div
        className="absolute inset-x-1 bg-primary/20 border-2 border-primary rounded pointer-events-none z-30 flex items-center justify-center"
        style={{ top: `${startY}px`, height: `${height}px` }}
      >
        <span className="text-xs font-medium text-primary">{durationText}</span>
      </div>
    );
  };

  const handleMobilePrev = () => {
    setMobileOffset(Math.max(0, mobileOffset - 1));
  };

  const handleMobileNext = () => {
    setMobileOffset(Math.min(7 - MOBILE_DAYS_VISIBLE, mobileOffset + 1));
  };

  const isToday = (date: Date) => {
    return format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  };

  const scrollContainerHeight = useMemo(() => {
    const hoursShown = visibleHours.length;
    const pixelsPerHour = 60;
    const contentHeight = hoursShown * pixelsPerHour;
    
    // Dynamic height: maximize screen space since button floats
    // Desktop: header (64px) + openings header (~140px) = ~200px
    // Mobile: add mobile nav (~48px) = ~248px
    const desktopViewportHeight = 'calc(100vh - 200px)';
    const mobileViewportHeight = 'calc(100vh - 248px)';
    
    if (showOnlyWorkingHours) {
      const buffer = 80;
      const calculatedHeight = contentHeight + buffer;
      // Use the smaller of calculated content height or viewport-based height
      // Note: This will use desktop height on desktop and mobile height on mobile via media queries
      return `min(${calculatedHeight}px, ${desktopViewportHeight})`;
    }
    
    return desktopViewportHeight;
  }, [visibleHours.length, showOnlyWorkingHours]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
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
                You have {outsideHoursOpenings.length} appointment{outsideHoursOpenings.length !== 1 ? 's' : ''} outside of working hours this week
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
        {/* Calendar header with navigation - more compact */}
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm">
          {/* Desktop header with navigation */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreviousWeek}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium text-foreground text-sm">
              {format(weekDays[0], 'MMMM d')} - {format(weekDays[6], 'MMMM d, yyyy')}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextWeek}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile header with navigation */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMobilePrev}
              disabled={mobileOffset === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium text-foreground text-sm">
              {format(visibleDays[0], 'MMM d')} - {format(visibleDays[visibleDays.length - 1], 'MMM d, yyyy')}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMobileNext}
              disabled={mobileOffset >= 7 - MOBILE_DAYS_VISIBLE}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day columns header - Desktop */}
          <div className="hidden md:grid grid-cols-[64px_repeat(7,1fr)] border-t border-b border-border bg-muted/30">
            <div className="p-2" />
            {weekDays.map((day, index) => (
              <div
                key={index}
                className="p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {format(day, 'EEE d')}
              </div>
            ))}
          </div>

          {/* Day columns header - Mobile */}
          <div className="md:hidden grid grid-cols-[64px_repeat(3,1fr)] border-t border-b border-border bg-muted/30">
            <div className="p-2" />
            {visibleDays.map((day, index) => (
              <div
                key={index}
                className="p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {format(day, 'EEE d')}
              </div>
            ))}
          </div>
        </div>

        {/* Week grid */}
        <div className="relative" style={{ height: `${visibleHours.length * 60}px` }}>
          {/* Current time indicator */}
          {weekDays.some(isToday) && currentTimePosition >= 0 && currentTimePosition <= 100 && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${currentTimePosition}%` }}
            >
              <div className="relative">
                <div className="absolute left-16 right-0 h-0.5 bg-red-500" />
                <div className="absolute left-14 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500" />
              </div>
            </div>
          )}

          {/* Time labels and hour rows */}
          {visibleHours.map((hour, hourIndex) => (
            <div key={hour} className="grid grid-cols-[64px_repeat(7,1fr)] md:grid-cols-[64px_repeat(7,1fr)] h-[60px] border-b border-border/50">
              {/* Time label */}
              <div className="flex flex-col items-center justify-start pt-1 bg-muted/50 border-r border-border text-xs font-medium text-muted-foreground">
                {format(setHours(new Date(), hour), 'h a')}
              </div>

              {/* Desktop: All 7 days */}
              {weekDays.map((day, dayIndex) => {
                const dayName = format(day, 'EEEE').toLowerCase();
                const dayHours = workingHours[dayName];
                const isNonWorking = dayHours?.enabled && (hour < parseInt(dayHours.start.split(':')[0]) || hour >= parseInt(dayHours.end.split(':')[0]));

                return (
                  <div
                    key={dayIndex}
                    className="hidden md:block relative border-l border-border/50"
                  >
                    {/* Non-working hours shading */}
                    {isNonWorking && (
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,hsl(var(--muted)/0.15)_8px,hsl(var(--muted)/0.15)_16px)]" />
                    )}
                    
                    {/* Clickable area */}
                    <button
                      onMouseDown={(e) => handleMouseDown(e, hour, dayIndex)}
                      className="absolute inset-0 hover:bg-accent/5 transition-colors cursor-crosshair"
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {/* Desktop: Opening cards for all days */}
          <div className="hidden md:grid absolute inset-0 grid-cols-[64px_repeat(7,1fr)] pointer-events-none">
            <div />
            {weekDays.map((day, dayIndex) => {
              const dayOpenings = openings.filter(o => 
                format(new Date(o.start_time), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
              );
              const positions = getOpeningPositionsForDay(day, dayOpenings);

              return (
                <div key={dayIndex} className="relative pointer-events-auto">
                  {positions.map(({ opening, style }) => (
                    <OpeningCard
                      key={opening.id}
                      opening={opening}
                      onClick={() => onOpeningClick(opening)}
                      style={style}
                      isHighlighted={highlightedOpeningId === opening.id}
                    />
                  ))}
                  {getDragPreview(dayIndex)}
                </div>
              );
            })}
          </div>

          {/* Mobile: Opening cards for visible days only */}
          <div className="md:hidden absolute inset-0 grid grid-cols-[64px_repeat(3,1fr)] pointer-events-none">
            <div />
            {visibleDays.map((day, visibleIndex) => {
              const actualDayIndex = mobileOffset + visibleIndex;
              const dayOpenings = openings.filter(o =>
                format(new Date(o.start_time), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
              );
              const positions = getOpeningPositionsForDay(day, dayOpenings);

              return (
                <div key={visibleIndex} className="relative pointer-events-auto">
                  {positions.map(({ opening, style }) => (
                    <OpeningCard
                      key={opening.id}
                      opening={opening}
                      onClick={() => onOpeningClick(opening)}
                      style={style}
                      isHighlighted={highlightedOpeningId === opening.id}
                    />
                  ))}
                  {getDragPreview(actualDayIndex)}
                </div>
              );
            })}
          </div>

          {/* Mobile: Time slot click handlers */}
          <div className="md:hidden absolute inset-0 grid grid-cols-[64px_repeat(3,1fr)]">
            <div />
            {visibleDays.map((day, visibleIndex) => {
              const actualDayIndex = mobileOffset + visibleIndex;
              return (
                <div key={visibleIndex} className="relative">
                  {visibleHours.map((hour) => {
                    const dayName = format(day, 'EEEE').toLowerCase();
                    const dayHours = workingHours[dayName];
                    const isNonWorking = dayHours?.enabled && (hour < parseInt(dayHours.start.split(':')[0]) || hour >= parseInt(dayHours.end.split(':')[0]));

                    return (
                      <div
                        key={hour}
                        className="relative h-[60px] border-l border-b border-border/50"
                      >
                        {/* Non-working hours shading */}
                        {isNonWorking && (
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,hsl(var(--muted)/0.3)_10px,hsl(var(--muted)/0.3)_20px)]" />
                        )}
                        
                        {/* Clickable area */}
                        <button
                          onMouseDown={(e) => handleMouseDown(e, hour, actualDayIndex)}
                          className="absolute inset-0 hover:bg-accent/5 transition-colors cursor-crosshair"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend with toggle - matching Day view */}
      <div className="border-t border-border bg-muted/30 px-4 py-2.5 flex flex-wrap items-start justify-between gap-3">
        <CalendarLegend compact className="order-1" />
        <div className="flex items-center gap-2 ml-auto order-3">
          <Label 
            htmlFor="week-working-hours-toggle" 
            className="text-muted-foreground cursor-pointer text-xs"
          >
            Only show working hours
          </Label>
          <Switch
            id="week-working-hours-toggle"
            checked={showOnlyWorkingHours}
            onCheckedChange={setShowOnlyWorkingHours}
          />
        </div>
      </div>
    </div>
  );
};
