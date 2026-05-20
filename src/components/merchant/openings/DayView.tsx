import { useEffect, useRef, useMemo, useState } from 'react';
import { format, setHours, setMinutes, parse } from 'date-fns';
import { Opening, WorkingHours } from '@/types/openings';
import { OpeningCard } from './OpeningCard';
import { CalendarLegend } from './CalendarLegend';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
interface DayViewProps {
  currentDate: Date;
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date, duration?: number) => void;
  onOpeningClick: (opening: Opening) => void;
  highlightedOpeningId?: string | null;
  profileDefaultDuration?: number;
  onPreviousDay: () => void;
  onNextDay: () => void;
  getStaffName?: (staffId: string | null) => string | null;
}
export const DayView = ({
  currentDate,
  openings,
  workingHours,
  onTimeSlotClick,
  onOpeningClick,
  highlightedOpeningId,
  profileDefaultDuration,
  onPreviousDay,
  onNextDay,
  getStaffName
}: DayViewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showOnlyWorkingHours, setShowOnlyWorkingHours] = useState(() => {
    const saved = localStorage.getItem('openings-show-working-hours');
    return saved !== null ? saved === 'true' : true;
  });
  const [hasVerticalOverflow, setHasVerticalOverflow] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    y: number;
    time: Date;
  } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{
    y: number;
    time: Date;
  } | null>(null);
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

  // Parse working hours (including minutes)
  const [workingStartHour, workingStartMinute] = dayWorkingHours?.enabled ? dayWorkingHours.start.split(':').map(Number) : [0, 0];
  const [workingEndHour, workingEndMinute] = dayWorkingHours?.enabled ? dayWorkingHours.end.split(':').map(Number) : [24, 0];

  // Filter hours based on toggle (extends to show appointments that partially overlap working hours)
  const { minHour, maxHour } = useMemo(() => {
    if (!showOnlyWorkingHours) return { minHour: 0, maxHour: 24 };

    let min = 24;
    let max = 0;

    if (dayWorkingHours?.enabled) {
      const [startHour] = dayWorkingHours.start.split(':').map(Number);
      const [endHour] = dayWorkingHours.end.split(':').map(Number);
      min = Math.min(min, startHour);
      max = Math.max(max, endHour);
    }

    openings.forEach(opening => {
      const startTime = new Date(opening.start_time);
      const endTime = new Date(opening.end_time);
      const startHour = startTime.getHours();
      const startMinute = startTime.getMinutes();
      const endHour = endTime.getHours();
      const endMinute = endTime.getMinutes();

      if (dayWorkingHours?.enabled) {
        const workingStartMinutes = workingStartHour * 60 + workingStartMinute;
        const workingEndMinutes = workingEndHour * 60 + workingEndMinute;
        const openingStartMinutes = startHour * 60 + startMinute;
        const openingEndMinutes = endHour * 60 + endMinute;

        // Check if appointment overlaps with working hours (ANY overlap, inclusive end boundary)
        const hasOverlap = openingStartMinutes <= workingEndMinutes && openingEndMinutes > workingStartMinutes;

        if (hasOverlap) {
          // Extend start if opening starts earlier than working hours (round DOWN to nearest 30-min)
          if (openingStartMinutes < workingStartMinutes) {
            const roundedStartMinutes = Math.floor(openingStartMinutes / 30) * 30;
            const roundedStartHour = Math.floor(roundedStartMinutes / 60);
            min = Math.min(min, roundedStartHour);
          }

          // Extend end if opening ends later than working hours (round UP to nearest 30-min)
          if (openingEndMinutes > workingEndMinutes) {
            const roundedEndMinutes = Math.ceil(openingEndMinutes / 30) * 30;
            const roundedEndHour = Math.floor(roundedEndMinutes / 60);
            max = Math.max(max, roundedEndHour);
          }
        }
      }
    });

    return { minHour: min === 24 ? 9 : min, maxHour: max === 0 ? 17 : max };
  }, [showOnlyWorkingHours, dayWorkingHours, openings, workingStartHour, workingStartMinute, workingEndHour, workingEndMinute]);

  const visibleHours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  // Detect openings outside working hours
  const outsideHoursOpenings = useMemo(() => {
    if (!showOnlyWorkingHours || !dayWorkingHours?.enabled) return [];
    return openings.filter(opening => {
      const startTime = new Date(opening.start_time);
      const startHour = startTime.getHours();
      const endHour = new Date(opening.end_time).getHours();
      const endMinute = new Date(opening.end_time).getMinutes();

      const workingStartMinutes = workingStartHour * 60 + workingStartMinute;
      const workingEndMinutes = workingEndHour * 60 + workingEndMinute;
      const startMinutes = startHour * 60 + startTime.getMinutes();
      const endMinutes = endHour * 60 + endMinute;

      return startMinutes < workingStartMinutes || endMinutes > workingEndMinutes;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [openings, showOnlyWorkingHours, workingStartHour, workingStartMinute, workingEndHour, workingEndMinute, dayWorkingHours]);
  const hasOpeningsOutsideWorkingHours = outsideHoursOpenings.length > 0;

  // Current time indicator
  const now = new Date();
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
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
      const scrollTarget = targetMinutes / totalMinutes * scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = scrollTarget;
    }
  }, [currentDate, minHour, totalMinutes]);

  // Helper: Check if two openings overlap in time
  const doOpeningsOverlap = (a: Opening, b: Opening): boolean => {
    const aStart = new Date(a.start_time).getTime();
    const aEnd = new Date(a.end_time).getTime();
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  };

  // Helper: Find all openings that overlap with a given opening
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
    return Array.from(group).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  // Helper: Assign columns to openings to minimize overlaps
  const assignColumns = (openings: Opening[]): Map<string, number> => {
    const columns = new Map<string, number>();
    const columnEndTimes: number[] = [];
    for (const opening of openings) {
      const startTime = new Date(opening.start_time).getTime();

      // Find first available column (where this opening doesn't overlap)
      let columnIndex = 0;
      while (columnIndex < columnEndTimes.length && columnEndTimes[columnIndex] > startTime) {
        columnIndex++;
      }
      columns.set(opening.id, columnIndex);
      columnEndTimes[columnIndex] = new Date(opening.end_time).getTime();
    }
    return columns;
  };

  const visibleOpenings = useMemo(() => {
    if (!showOnlyWorkingHours) return openings;

    if (!dayWorkingHours?.enabled) return [];

    const ws = workingStartHour * 60 + workingStartMinute;
    const we = workingEndHour * 60 + workingEndMinute;

    return openings.filter(opening => {
      const startTime = new Date(opening.start_time);
      const endTime = new Date(opening.end_time);
      const sMin = startTime.getHours() * 60 + startTime.getMinutes();
      const eMin = endTime.getHours() * 60 + endTime.getMinutes();
      return sMin <= we && eMin > ws;
    });
  }, [showOnlyWorkingHours, openings, dayWorkingHours, workingStartHour, workingStartMinute, workingEndHour, workingEndMinute]);

  // Calculate opening card positions with overlap handling
  const openingPositions = useMemo(() => {
    const hourRange = visibleHours.length || 24;

    // First pass: calculate basic positioning (top, height)
    const basicPositions = visibleOpenings.map(opening => {
      const start = new Date(opening.start_time);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const adjustedStartMinutes = startMinutes - minHour * 60;
      const top = adjustedStartMinutes / totalMinutes * 100;
      const height = opening.duration_minutes / (hourRange * 60) * 100;
      return {
        opening,
        top,
        height
      };
    });

    // Second pass: detect overlaps and assign columns
    const processed = new Set<string>();
    const columnAssignments = new Map<string, {
      column: number;
      totalColumns: number;
    }>();
    for (const {
      opening
    } of basicPositions) {
      if (processed.has(opening.id)) continue;

      // Find all openings that overlap with this one
      const overlappingGroup = findOverlappingGroup(opening, visibleOpenings);
      if (overlappingGroup.length === 1) {
        // No overlaps, use full width
        columnAssignments.set(opening.id, {
          column: 0,
          totalColumns: 1
        });
        processed.add(opening.id);
      } else {
        // Has overlaps, assign columns
        const columns = assignColumns(overlappingGroup);
        const maxColumn = Math.max(...Array.from(columns.values()));
        const totalColumns = maxColumn + 1;
        overlappingGroup.forEach(o => {
          columnAssignments.set(o.id, {
            column: columns.get(o.id) || 0,
            totalColumns
          });
          processed.add(o.id);
        });
      }
    }

    // Third pass: calculate final styles
    const timeColumnWidth = 68;
    const rightPadding = 16;
    return basicPositions.map(({
      opening,
      top,
      height
    }) => {
      const assignment = columnAssignments.get(opening.id) || {
        column: 0,
        totalColumns: 1
      };

      // Calculate column width as percentage
      const widthPercent = 100 / assignment.totalColumns;

      // Calculate left position: time column + (column index * column width as percentage)
      const leftPercent = assignment.column * widthPercent;
      return {
        opening,
        style: {
          top: `${top}%`,
          height: `${height}%`,
          left: `calc(${timeColumnWidth}px + ${leftPercent}% - ${leftPercent * rightPadding / 100}px)`,
          width: `calc(${widthPercent}% - ${rightPadding}px)`
        }
      };
    });
  }, [visibleOpenings, minHour, totalMinutes, visibleHours.length]);
  const handleMouseDown = (e: React.MouseEvent, hour: number) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;

    // Calculate exact click position within the hour
    const hourButton = e.currentTarget as HTMLElement;
    const hourRect = hourButton.getBoundingClientRect();
    const clickY = e.clientY - hourRect.top;
    const hourHeight = 60; // 60px per hour

    // Calculate minutes from click position
    const minutesFromClick = Math.floor(clickY / hourHeight * 60);

    // Round DOWN to nearest 15-minute interval
    const snappedMinutes = Math.floor(minutesFromClick / 15) * 15;
    const clickedTime = new Date(currentDate);
    clickedTime.setHours(hour, snappedMinutes, 0, 0);

    // Apply default duration from start time
    const defaultMinutes = profileDefaultDuration || 30;
    const initialEndTime = new Date(clickedTime);
    initialEndTime.setMinutes(initialEndTime.getMinutes() + defaultMinutes);
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;
    setIsDragging(true);
    setDragStart({
      y: relativeY,
      time: clickedTime
    });
    setDragCurrent({
      y: relativeY,
      time: initialEndTime
    });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;
    const hourHeight = 60;
    const totalMinutes = Math.floor((relativeY - dragStart.y) / hourHeight * 60);
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    const defaultMinutes = profileDefaultDuration || 30;

    // Allow shrinking to 15 min or expanding from default
    const finalMinutes = snappedMinutes === 0 ? defaultMinutes : Math.max(15, defaultMinutes + snappedMinutes);
    const endTime = new Date(dragStart.time);
    endTime.setMinutes(endTime.getMinutes() + finalMinutes);
    setDragCurrent({
      y: relativeY,
      time: endTime
    });
  };
  const handleMouseUp = () => {
    if (!isDragging || !dragStart) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    // Calculate duration - use merchant default if no drag movement
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
    const startY = startMinutes / 60 * hourHeight;
    const height = durationMinutes / 60 * hourHeight;
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return <div className="absolute left-16 right-0 bg-primary/20 border-2 border-primary rounded pointer-events-none z-30 flex items-center justify-center" style={{
      top: `${startY}px`,
      height: `${height}px`
    }}>
        <span className="text-sm font-medium text-primary">{durationText}</span>
      </div>;
  };
  const handleHourClick = (hour: number, e: React.MouseEvent) => {
    if (isDragging) return;
    const clickedTime = setMinutes(setHours(currentDate, hour), 0);
    onTimeSlotClick(clickedTime, profileDefaultDuration || 30);
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

    // Dynamic height: maximize screen space and include sticky chrome so
    // working-hours mode does not add bottom whitespace or force avoidable scroll.
    const viewportBasedHeight = 'calc(100vh - 200px)';
    if (showOnlyWorkingHours) {
      const dayHeaderChrome = 45;
      const noticeChrome = hasOpeningsOutsideWorkingHours && !noticeHidden ? 31 : 0;
      const calculatedHeight = contentHeight + dayHeaderChrome + noticeChrome;
      // Use the smaller of calculated content height or viewport-based height
      return `min(${calculatedHeight}px, ${viewportBasedHeight})`;
    }
    return viewportBasedHeight;
  }, [visibleHours.length, showOnlyWorkingHours, hasOpeningsOutsideWorkingHours, noticeHidden]);

  useEffect(() => {
    const scrollElement = scrollContainerRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return;

    let animationFrame: number | null = null;

    const measureOverflow = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        const overflow = scrollElement.scrollHeight - scrollElement.clientHeight > 1;
        setHasVerticalOverflow(prev => (prev === overflow ? prev : overflow));
      });
    };

    measureOverflow();
    window.addEventListener('resize', measureOverflow);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measureOverflow);
      resizeObserver.observe(scrollElement);
      resizeObserver.observe(contentElement);
    }

    return () => {
      window.removeEventListener('resize', measureOverflow);
      resizeObserver?.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [scrollContainerHeight, currentDate, visibleHours.length, openings.length, hasOpeningsOutsideWorkingHours, noticeHidden]);

  return <div key={currentDate.toISOString().split('T')[0]} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-opacity duration-150 ease-in-out">
      <div ref={scrollContainerRef} className="relative overflow-x-hidden" style={{
      height: scrollContainerHeight,
      overflowY: hasVerticalOverflow ? 'auto' : 'hidden'
    }} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        {/* Day header with navigation - more compact */}
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 py-2">
            <Button variant="ghost" size="sm" onClick={onPreviousDay} className="h-7 w-7 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium text-foreground text-sm">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </div>
            <Button variant="ghost" size="sm" onClick={onNextDay} className="h-7 w-7 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Outside working hours notice - dismissible */}
        {hasOpeningsOutsideWorkingHours && !noticeHidden && <div className="sticky top-[49px] z-40 bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-sm border-b border-amber-200/50 dark:border-amber-800/50">
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
              <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              
              <span className="text-amber-700 dark:text-amber-300 flex-1">
                You have {outsideHoursOpenings.length} appointment{outsideHoursOpenings.length !== 1 ? 's' : ''} outside of working hours today
              </span>
              
              <button onClick={handleShowAll} className="text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 font-medium underline underline-offset-2 flex-shrink-0">
                Show all
              </button>
              
              <button onClick={() => setNoticeHidden(true)} className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex-shrink-0 p-0.5" aria-label="Dismiss notice">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>}
        
        {/* Calendar header for context */}
        

        {/* Time grid */}
        <div ref={contentRef} className="relative overflow-hidden" style={{
        minHeight: `${containerHeight}px`
      }}>
          {getDragPreview()}
          
          {/* Hour rows */}
          {visibleHours.map(hour => <div key={hour} className="relative h-[60px] border-b border-border group">
              {/* Time label - sticky */}
              <div className="absolute left-0 top-0 w-16 h-full bg-muted/50 border-r border-border z-10 flex flex-col items-center justify-start pt-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {format(setHours(currentDate, hour), 'h a')}
                </span>
              </div>

              {/* Non-working hours shading */}
              {isNonWorkingHour(hour) && <div className="absolute left-16 right-0 top-0 bottom-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,hsl(var(--muted)/0.15)_8px,hsl(var(--muted)/0.15)_16px)]" />}

              {/* Clickable area */}
              <div onMouseDown={e => handleMouseDown(e, hour)} onClick={e => handleHourClick(hour, e)} className="absolute left-16 right-0 top-0 bottom-0 cursor-pointer transition-colors">
                {/* Empty slot hint on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {!isDragging && <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      Click or drag to add opening
                    </span>}
                </div>
              </div>

              {/* 30-minute line */}
              <div className="absolute left-16 right-0 top-1/2 border-t border-dashed border-border/50" />
            </div>)}

          {/* Current time indicator */}
          {isToday && currentTimePosition >= 0 && currentTimePosition <= 100 && <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{
          top: `${currentTimePosition}%`
        }}>
              <div className="relative">
                <div className="absolute left-16 right-0 h-0.5 bg-red-500" />
                <div className="absolute left-14 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500" />
              </div>
            </div>}

          {/* Opening cards */}
          {openingPositions.map(({ opening, style }) => (
            <OpeningCard
              key={opening.id}
              opening={opening}
              onClick={() => onOpeningClick(opening)}
              style={style}
              isHighlighted={opening.id === highlightedOpeningId}
              staffName={getStaffName?.(opening.staff_id) || undefined}
            />
          ))}
        </div>
      </div>

      {/* Legend with toggle */}
      <div className="border-t border-border bg-muted/30 px-4 py-2.5 flex flex-wrap items-start justify-between gap-3">
        <CalendarLegend compact className="order-1" />
        <div className="flex items-center gap-2 ml-auto order-3">
          <Label htmlFor="working-hours-toggle" className="text-muted-foreground cursor-pointer text-xs">
            Only show working hours
          </Label>
          <Switch id="working-hours-toggle" checked={showOnlyWorkingHours} onCheckedChange={setShowOnlyWorkingHours} />
        </div>
      </div>
    </div>;
};
